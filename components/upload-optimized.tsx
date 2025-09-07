'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, BarChart3, TrendingUp, Clock, AlertCircle, CheckCircle, X } from 'lucide-react';

interface UploadResult {
  fileId: string;
  message: string;
  fileName: string;
  fileSize: number;
}

interface AnalysisStatus {
  status: 'processing' | 'completed' | 'failed' | 'not_found' | 'expired';
  progress?: number;
  processedLines?: number;
  fileName?: string;
  uploadTime?: string;
  error?: string;
  result?: any;
}

interface FileWithProgress {
  file: File;
  id: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: UploadResult;
  error?: string;
}

const FileUploadOptimized: React.FC = () => {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);

  // 轮询文件状态
  useEffect(() => {
    if (!activeFileId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/result/${activeFileId}`);
        const data: AnalysisStatus = await response.json();

        if (data.status === 'completed') {
          setAnalysisData(data.result);
          updateFileStatus(activeFileId, 'completed', 100);
          clearInterval(pollInterval);
        } else if (data.status === 'processing') {
          updateFileStatus(activeFileId, 'processing', data.progress || 0);
        } else if (data.status === 'failed') {
          updateFileStatus(activeFileId, 'failed', 0, data.error);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [activeFileId]);

  const updateFileStatus = (fileId: string, status: FileWithProgress['status'], progress: number, error?: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status, progress, error } : f
    ));
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: crypto.randomUUID(),
      status: 'uploading' as const,
      progress: 0
    }));

    setFiles(prev => [...newFiles, ...prev]);

    // 上传每个文件
    for (const fileObj of newFiles) {
      try {
        const formData = new FormData();
        formData.append('file', fileObj.file);

        const response = await fetch('/api/upload-optimized', {
          method: 'POST',
          body: formData
        });

        const result: UploadResult = await response.json();

        if (response.ok) {
          fileObj.status = 'processing';
          fileObj.result = result;
          setActiveFileId(result.fileId);
        } else {
          fileObj.status = 'failed';
          fileObj.error = result.error;
        }
      } catch (error) {
        fileObj.status = 'failed';
        fileObj.error = '上传失败';
      }

      setFiles(prev => [...prev]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxSize: 200 * 1024 * 1024, // 200MB
    multiple: true
  });

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    if (activeFileId === fileId) {
      setActiveFileId(null);
      setAnalysisData(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('zh-CN').format(num);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 上传区域 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {isDragActive ? (
            <p className="text-lg text-gray-600">拖放文件到这里...</p>
          ) : (
            <div>
              <p className="text-lg text-gray-600 mb-2">
                拖放CSV文件到这里，或点击选择文件
              </p>
              <p className="text-sm text-gray-500">
                支持最大200MB的CSV文件
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">文件列表</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {files.map((fileObj) => (
              <div key={fileObj.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {fileObj.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(fileObj.file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {fileObj.status === 'uploading' && (
                        <>
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${fileObj.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {fileObj.progress}%
                          </span>
                        </>
                      )}
                      {fileObj.status === 'processing' && (
                        <>
                          <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
                          <span className="text-xs text-yellow-600">
                            处理中 {fileObj.progress}%
                          </span>
                        </>
                      )}
                      {fileObj.status === 'completed' && (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-green-600">已完成</span>
                        </>
                      )}
                      {fileObj.status === 'failed' && (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span className="text-xs text-red-600">
                            {fileObj.error || '失败'}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => removeFile(fileObj.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 分析结果 */}
      {analysisData && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              分析结果
            </h3>
          </div>
          
          {/* 概览卡片 */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-blue-600 text-sm font-medium">总收入</div>
              <div className="text-2xl font-bold text-blue-900">
                ¥{formatNumber(analysisData.summary.totalRevenue.toFixed(2))}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-green-600 text-sm font-medium">总展示次数</div>
              <div className="text-2xl font-bold text-green-900">
                {formatNumber(analysisData.summary.totalImpressions)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-purple-600 text-sm font-medium">平均eCPM</div>
              <div className="text-2xl font-bold text-purple-900">
                ¥{analysisData.summary.avgEcpm.toFixed(2)}
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-orange-600 text-sm font-medium">总点击率</div>
              <div className="text-2xl font-bold text-orange-900">
                {analysisData.summary.avgCtr.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* 图表区域 */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 网站收益排行 */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">网站收益排行</h4>
              <div className="space-y-3">
                {analysisData.topWebsites.slice(0, 10).map((item: any, index: number) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                      <span className="text-sm text-gray-900 truncate max-w-xs">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        ¥{formatNumber(item.revenue.toFixed(2))}
                      </div>
                      <div className="text-xs text-gray-500">
                        eCPM: ¥{item.avgEcpm.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 国家/地区收益排行 */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">国家/地区收益排行</h4>
              <div className="space-y-3">
                {analysisData.topCountries.slice(0, 10).map((item: any, index: number) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                      <span className="text-sm text-gray-900">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        ¥{formatNumber(item.revenue.toFixed(2))}
                      </div>
                      <div className="text-xs text-gray-500">
                        展示: {formatNumber(item.impressions)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 样本数据表格 */}
          <div className="p-6 border-t border-gray-200">
            <h4 className="text-md font-medium text-gray-900 mb-4">数据样本 (前3000行)</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      网站
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      国家
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      广告格式
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      设备
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      展示次数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      收入
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      eCPM
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analysisData.sampleData.slice(0, 100).map((row: any, index: number) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.website}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.country}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.adFormat}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.device}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(row.impressions)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ¥{row.revenue.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ¥{row.ecpm.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {analysisData.sampleData.length > 100 && (
              <div className="mt-4 text-center text-sm text-gray-500">
                显示前100行，共{analysisData.sampleData.length}行样本数据
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadOptimized;