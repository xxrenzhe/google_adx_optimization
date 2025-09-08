import { formatCurrency, formatNumber, formatPercentage, debounce } from '@/lib/utils'

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('formats numbers as Chinese currency', () => {
      expect(formatCurrency(1234.56)).toBe('¥1,234.56')
      expect(formatCurrency(0)).toBe('¥0.00')
      expect(formatCurrency(1000000)).toBe('¥1,000,000.00')
    })
  })

  describe('formatNumber', () => {
    it('formats numbers with abbreviations', () => {
      expect(formatNumber(1234567)).toBe('1.2M')
      expect(formatNumber(1234)).toBe('1.2K')
      expect(formatNumber(123)).toBe('123')
      expect(formatNumber(0)).toBe('0')
    })
  })

  describe('formatPercentage', () => {
    it('formats numbers as percentages', () => {
      expect(formatPercentage(12.34)).toBe('12.34%')
      expect(formatPercentage(0)).toBe('0.00%')
      expect(formatPercentage(100)).toBe('100.00%')
    })
  })

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('delays function execution', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 1000)

      debouncedFn()
      expect(mockFn).not.toHaveBeenCalled()

      jest.advanceTimersByTime(500)
      expect(mockFn).not.toHaveBeenCalled()

      jest.advanceTimersByTime(500)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('calls function with correct arguments', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 1000)

      debouncedFn('arg1', 'arg2')
      jest.advanceTimersByTime(1000)

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
    })

    it('only calls once for multiple rapid calls', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 1000)

      debouncedFn()
      debouncedFn()
      debouncedFn()
      jest.advanceTimersByTime(1000)

      expect(mockFn).toHaveBeenCalledTimes(1)
    })
  })
})