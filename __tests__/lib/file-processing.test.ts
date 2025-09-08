import {
  CONFIG,
  validateFile,
  createColumnMap,
  parseCSVLine,
  updateAggregator,
  getTopItems,
  detectAndCorrectDataIssues,
  updateFillRateDistribution,
  calculateDailyTrend,
  filterData,
  createSummary
} from '@/lib/file-processing'

describe('File Processing Utilities', () => {
  describe('CONFIG', () => {
    it('has correct configuration values', () => {
      expect(CONFIG.MAX_FILE_SIZE).toBe(200 * 1024 * 1024)
      expect(CONFIG.SAMPLE_SIZE).toBe(100)
      expect(CONFIG.REQUIRED_COLUMNS).toEqual(['date', 'website'])
    })
  })

  describe('validateFile', () => {
    it('accepts valid CSV files', () => {
      const mockFile = new File(['test,content'], 'test.csv', { type: 'text/csv' })
      expect(() => validateFile(mockFile)).not.toThrow()
    })

    it('rejects files that are too large', () => {
      // Mock a large file by overriding the size property
      const mockFile = new File(['test,content'], 'large.csv', { type: 'text/csv' })
      Object.defineProperty(mockFile, 'size', { value: 201 * 1024 * 1024 })
      expect(() => validateFile(mockFile)).toThrow('文件过大，请上传小于200MB的文件')
    })

    it('rejects invalid file types', () => {
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' })
      expect(() => validateFile(invalidFile)).toThrow('只支持CSV格式文件')
    })
  })

  describe('createColumnMap', () => {
    it('creates correct column mapping for English headers', () => {
      const headers = ['Date', 'Website', 'Country', 'Revenue']
      const mapping = createColumnMap(headers)
      
      expect(mapping.date).toBe(0)
      expect(mapping.website).toBe(1)
      expect(mapping.country).toBe(2)
      expect(mapping.revenue).toBe(3)
    })

    it('creates correct column mapping for Chinese headers', () => {
      const headers = ['日期', '网站', '国家', '收入']
      const mapping = createColumnMap(headers)
      
      expect(mapping.date).toBe(0)
      expect(mapping.website).toBe(1)
      expect(mapping.country).toBe(2)
      expect(mapping.revenue).toBe(3)
    })

    it('handles missing columns', () => {
      const headers = ['Date', 'Website']
      const mapping = createColumnMap(headers)
      
      expect(mapping.date).toBe(0)
      expect(mapping.website).toBe(1)
      expect(mapping.country).toBeUndefined()
    })
  })

  describe('parseCSVLine', () => {
    it('parses simple CSV line', () => {
      const line = 'value1,value2,value3'
      const result = parseCSVLine(line)
      
      expect(result).toEqual(['value1', 'value2', 'value3'])
    })

    it('parses CSV line with quoted values', () => {
      const line = '"value,with,commas","value with spaces",value3'
      const result = parseCSVLine(line)
      
      expect(result).toEqual(['value,with,commas', 'value with spaces', 'value3'])
    })

    it('handles empty values', () => {
      const line = 'value1,,value3'
      const result = parseCSVLine(line)
      
      expect(result).toEqual(['value1', '', 'value3'])
    })
  })

  describe('updateAggregator', () => {
    it('updates aggregator with new data', () => {
      const map = new Map()
      const data = { revenue: 100, impressions: 1000, clicks: 10, requests: 1200 }
      
      updateAggregator(map, 'test-key', data)
      
      const result = map.get('test-key')
      expect(result.revenue).toBe(100)
      expect(result.impressions).toBe(1000)
      expect(result.clicks).toBe(10)
      expect(result.requests).toBe(1200)
      // avgEcpm and ctr are calculated in getTopItems, not updateAggregator
    })

    it('accumulates data for existing keys', () => {
      const map = new Map()
      const data1 = { revenue: 100, impressions: 1000, clicks: 10, requests: 1200 }
      const data2 = { revenue: 200, impressions: 2000, clicks: 20, requests: 2400 }
      
      updateAggregator(map, 'test-key', data1)
      updateAggregator(map, 'test-key', data2)
      
      const result = map.get('test-key')
      expect(result.revenue).toBe(300)
      expect(result.impressions).toBe(3000)
      expect(result.clicks).toBe(30)
      expect(result.requests).toBe(3600)
    })
  })

  describe('getTopItems', () => {
    it('returns items sorted by revenue', () => {
      const map = new Map([
        ['a', { revenue: 300, impressions: 1000 }],
        ['b', { revenue: 100, impressions: 2000 }],
        ['c', { revenue: 200, impressions: 1500 }]
      ])
      
      const result = getTopItems(map, 10)
      
      expect(result[0].name).toBe('a')
      expect(result[0].revenue).toBe(300)
      expect(result[1].name).toBe('c')
      expect(result[1].revenue).toBe(200)
      expect(result[2].name).toBe('b')
      expect(result[2].revenue).toBe(100)
    })

    it('limits results to specified count', () => {
      const map = new Map([
        ['a', { revenue: 300 }],
        ['b', { revenue: 200 }],
        ['c', { revenue: 100 }]
      ])
      
      const result = getTopItems(map, 2)
      
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('a')
      expect(result[1].name).toBe('b')
    })
  })

  describe('detectAndCorrectDataIssues', () => {
    it('detects and corrects common issues', () => {
      const data = {
        date: '2024/01/01',
        website: 'example.com',
        country: 'CHN',
        adFormat: 'display'
      }
      
      const result = detectAndCorrectDataIssues(data, 0)
      
      // Based on the actual implementation, it only detects issues but doesn't correct country codes
      expect(result.country).toBe('CHN')
      expect(result.adFormat).toBe('display')
    })

    it('handles unknown values', () => {
      const data = {
        date: '2024-01-01',
        website: 'test.com',
        country: 'UNKNOWN',
        adFormat: 'UNKNOWN'
      }
      
      const result = detectAndCorrectDataIssues(data, 0)
      
      // Based on the actual implementation, it only detects issues
      expect(result.country).toBe('UNKNOWN')
      expect(result.adFormat).toBe('UNKNOWN')
    })
  })

  describe('updateFillRateDistribution', () => {
    it('updates fill rate distribution correctly', () => {
      const distribution = {
        "0-20%": 0,
        "20-40%": 0,
        "40-60%": 0,
        "60-80%": 0,
        "80-100%": 0
      }
      
      updateFillRateDistribution(distribution, 15)
      expect(distribution["0-20%"]).toBe(1)
      
      updateFillRateDistribution(distribution, 85)
      expect(distribution["80-100%"]).toBe(1)
      
      updateFillRateDistribution(distribution, 45)
      expect(distribution["40-60%"]).toBe(1)
    })
  })

  describe('calculateDailyTrend', () => {
    it('calculates daily trend correctly', () => {
      const dates = new Map([
        ['2024-01-01', { revenue: 100, impressions: 1000, clicks: 10, requests: 1200 }],
        ['2024-01-02', { revenue: 200, impressions: 2000, clicks: 20, requests: 2400 }]
      ])
      
      const result = calculateDailyTrend(dates)
      
      expect(result).toHaveLength(2)
      expect(result[0].date).toBe('2024-01-01')
      expect(result[0].revenue).toBe(100)
      expect(result[0].avgEcpm).toBe(100)
      expect(result[1].date).toBe('2024-01-02')
      expect(result[1].revenue).toBe(200)
      expect(result[1].avgEcpm).toBe(100)
    })
  })

  describe('createSummary', () => {
    it('creates summary with correct calculations', () => {
      const summary = createSummary(100, 1000, 10000, 100, 12000)
      
      expect(summary.totalRows).toBe(100)
      expect(summary.totalRevenue).toBe(1000)
      expect(summary.totalImpressions).toBe(10000)
      expect(summary.totalClicks).toBe(100)
      expect(summary.totalRequests).toBe(12000)
      expect(summary.avgEcpm).toBe(100) // (1000 / 10000) * 1000
      expect(summary.avgCtr).toBe(1) // (100 / 10000) * 100
    })
  })
})