'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, BarChart3, TrendingUp, Clock, AlertCircle, CheckCircle, X } from 'lucide-react';


interface UploadResult {
  fileId: string;
  message: string;
  fileName: string;
  fileSize: number;
  error?: string;
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

interface Props {
  fileId: string | null;
  onFileUploaded: (fileId: string) => void;
  onClearFile: () => void;
}

const FileUploadOptimized: React.FC<Props> = ({ fileId, onFileUploaded, onClearFile }) => {
  
  // 简化的本地状态
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(fileId);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  
  // 使用 ref 来避免闭包问题
  const filesRef = useRef(files);
  filesRef.current = files;
  
  const activeFileIdRef = useRef(activeFileId);
  activeFileIdRef.current = activeFileId;
  
  // 同步URL fileId的变化
  useEffect(() => {
    setActiveFileId(fileId);
    if (!fileId) {
      // 如果URL中没有fileId，清除本地状态
      setFiles([]);
      setAnalysisData(null);
    }
  }, [fileId]);
  
  // 只在客户端设置标记
  useEffect(() => {
    if (isClient) return; // 防止重复运行
    setIsClient(true);
  }, []);

  // 清理stale数据 - 只在必要时清理
  useEffect(() => {
    if (activeFileId && filesRef.current.length > 0) {
      const activeFile = filesRef.current.find(f => f.id === activeFileId);
      if (!activeFile) {
        // 检查localStorage中是否有该文件的数据
        const savedFiles = localStorage.getItem('upload-optimized-files');
        if (savedFiles) {
          const files = JSON.parse(savedFiles);
          const savedFile = files.find((f: any) => f.id === activeFileId);
          if (savedFile) {
            // 从localStorage恢复文件
            setFiles([savedFile]);
            return;
          }
        }
        // 只有当文件确实不存在时才清理
        setActiveFileId(null);
        setAnalysisData(null);
      }
    }
  }, [activeFileId]);

  // 自动清理旧文件（确保只保留当前文件）
  useEffect(() => {
    if (filesRef.current.length > 1) {
      // 只保留当前活跃文件或最新文件
      const fileToKeep = activeFileIdRef.current 
        ? filesRef.current.find(f => f.id === activeFileIdRef.current)
        : filesRef.current[filesRef.current.length - 1];
      
      if (fileToKeep && fileToKeep.id !== filesRef.current[0].id) {
        setFiles([fileToKeep]);
      }
    }
  }, [files]);

  // 组件挂载时设置活跃文件（只从localStorage恢复）
  useEffect(() => {
    // 只从localStorage恢复，不自动设置其他文件为活跃
    if (!activeFileIdRef.current && filesRef.current.length > 0) {
      const savedActiveFileId = localStorage.getItem('upload-optimized-active-file');
      if (savedActiveFileId) {
        const fileExists = filesRef.current.find(f => f.id === savedActiveFileId);
        if (fileExists) {
          setActiveFileId(savedActiveFileId);
        }
      }
    }
  }, [files]);

  // 处理已完成文件的分析数据获取
  useEffect(() => {
    if (isClient && activeFileId && files.length > 0) {
      const activeFile = files.find(f => f.id === activeFileId);
      if (activeFile && activeFile.status === 'completed' && !analysisData) {
        // 立即获取分析数据
        fetch(`/api/result/${activeFileId}`)
          .then(response => response.json())
          .then((data: AnalysisStatus) => {
            console.log('[DEBUG] Fetched analysis data:', data);
            if (data.status === 'completed' && data.result) {
              console.log('[DEBUG] Setting analysis data with samplePreview length:', data.result.samplePreview?.length || data.result.sampleData?.length);
              setAnalysisData(data.result);
            }
          })
          .catch(error => {
            console.error('Error fetching analysis data for completed file:', error);
          });
      }
    }
  }, [isClient, activeFileId, files, analysisData]);

  // 处理页面刷新后恢复分析数据
  useEffect(() => {
    if (isClient && activeFileId && files.length === 0 && !analysisData) {
      console.log('[DEBUG] No files in array but activeFileId exists, trying to fetch analysis data');
      // 尝试直接获取分析数据
      fetch(`/api/result/${activeFileId}`)
        .then(response => response.json())
        .then((data: AnalysisStatus) => {
          console.log('[DEBUG] Fetched analysis data after reload:', data);
          if (data.status === 'completed' && data.result) {
            console.log('[DEBUG] Setting analysis data with samplePreview length:', data.result.samplePreview?.length || data.result.sampleData?.length);
            setAnalysisData(data.result);
            // 创建一个虚拟的文件对象用于显示
            const virtualFile = {
              file: new File([], data.result.fileName || 'Unknown', { type: 'text/csv' }),
              id: activeFileId,
              status: 'completed' as const,
              progress: 100,
              result: { fileId: activeFileId, message: 'File restored from reload', fileName: data.result.fileName || 'Unknown', fileSize: 0 }
            };
            setFiles([virtualFile]);
          }
        })
        .catch(error => {
          console.error('Error fetching analysis data after reload:', error);
          // 如果获取失败，清除activeFileId
          setActiveFileId(null);
        });
    }
  }, [isClient, activeFileId, files, analysisData]);

  // Server-Sent Events (SSE) 实现替换复杂的轮询逻辑
  useEffect(() => {
    if (!activeFileId) return;
    
    // 检查activeFileId是否在当前files列表中
    const currentFile = files.find(f => f.id === activeFileId);
    if (!currentFile) {
      // 如果文件不在当前列表中，清除activeFileId
      setActiveFileId(null);
      setAnalysisData(null);
      return;
    }
    
    // 检查是否需要建立SSE连接
    if (currentFile.status === 'completed' && !analysisData) {
      // 如果文件已完成但没有分析数据，直接获取结果
      console.log(`[DEBUG] File completed but no analysis data, fetching result...`);
      fetch(`/api/result/${activeFileId}`)
        .then(response => response.json())
        .then((data: AnalysisStatus) => {
          if (data.status === 'completed' && data.result) {
            setAnalysisData(data.result);
          }
        })
        .catch(error => {
          console.error('Error fetching analysis data:', error);
        });
      return;
    }
    
    // 只有在处理中或上传中状态才建立SSE连接
    if (currentFile.status !== 'processing' && currentFile.status !== 'uploading') {
      return;
    }
    
    console.log(`[DEBUG] Starting SSE connection for file ${activeFileId}`);
    
    // 创建EventSource连接
    const eventSource = new EventSource(`/api/sse/${activeFileId}`);
    
    // 处理连接打开
    eventSource.onopen = () => {
      console.log(`[DEBUG] SSE connection opened for file ${activeFileId}`);
    };
    
    // 处理消息
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[DEBUG] SSE message:`, data);
        
        switch (data.type) {
          case 'connected':
            console.log(`[DEBUG] SSE connection confirmed for file ${data.fileId}`);
            break;
            
          case 'status':
          case 'processing':
            // 更新处理进度
            updateFileStatus(activeFileId, 'processing', data.progress || 0);
            break;
            
          case 'completed':
            console.log(`[DEBUG] SSE: Analysis completed for file ${activeFileId}`);
            console.log(`[DEBUG] Sample data length:`, data.result?.samplePreview?.length || data.result?.sampleData?.length);
            setAnalysisData(data.result);
            updateFileStatus(activeFileId, 'completed', 100);
            // 关闭连接
            eventSource.close();
            break;
            
          case 'failed':
            console.error(`[DEBUG] SSE: Processing failed for file ${activeFileId}`);
            updateFileStatus(activeFileId, 'failed', 0, data.error);
            eventSource.close();
            break;
            
          case 'timeout':
            console.error(`[DEBUG] SSE: Processing timeout for file ${activeFileId}`);
            updateFileStatus(activeFileId, 'failed', 0, data.message);
            eventSource.close();
            break;
            
          case 'error':
            console.error(`[DEBUG] SSE: Connection error for file ${activeFileId}`);
            updateFileStatus(activeFileId, 'failed', 0, data.message);
            eventSource.close();
            break;
            
          default:
            console.warn(`[DEBUG] Unknown SSE message type:`, data.type);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };
    
    // 处理错误
    eventSource.onerror = (error) => {
      console.error(`[DEBUG] SSE connection error for file ${activeFileId}:`, error);
      updateFileStatus(activeFileId, 'failed', 0, '连接失败，请重试');
      eventSource.close();
    };
    
    // 清理函数：组件卸载时关闭连接
    return () => {
      console.log(`[DEBUG] Cleaning up SSE connection for file ${activeFileId}`);
      eventSource.close();
    };
  }, [activeFileId, analysisData, files]);

  const updateFileStatus = (fileId: string, status: FileWithProgress['status'], progress: number, error?: string) => {
    setFiles(prev => 
      prev.map(f => 
        f.id === fileId ? { ...f, status, progress, error } : f
      )
    );
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // 如果已有文件，先清除
    if (filesRef.current.length > 0) {
      setFiles([]);
      setActiveFileId(null);
      setAnalysisData(null);
      onClearFile();
    }

    const newFiles: FileWithProgress[] = acceptedFiles.map(file => ({
      file,
      id: crypto.randomUUID(),
      status: 'uploading',
      progress: 0
    }));

    setFiles(newFiles);

    // 上传每个文件（只处理第一个文件）
    const fileObj = newFiles[0];
    try {
      const formData = new FormData();
      formData.append('file', fileObj.file);

      const response = await fetch('/api/upload-optimized', {
        method: 'POST',
        body: formData
      });

      const result: UploadResult = await response.json();

      if (response.ok) {
        // 创建新的文件对象，更新状态和ID
        const updatedFile = {
          ...fileObj,
          status: 'processing' as const,
          result,
          id: result.fileId
        };
        
        // 更新files数组 - 只更新对应的文件
        setFiles(prev => prev.map(f => f.id === fileObj.id ? updatedFile : f));
        setActiveFileId(result.fileId);
        // 通知父组件
        onFileUploaded(result.fileId);
      } else {
        // 更新失败状态
        setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'failed' as const, error: result.error } : f));
      }
    } catch (error) {
      // 更新失败状态
      setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'failed' as const, error: '上传失败' } : f));
    }
  }, [onClearFile, onFileUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxSize: 200 * 1024 * 1024, // 200MB
    multiple: false // 只允许单文件上传
  });

  const removeFile = (fileId: string) => {
    setFiles([]);
    setActiveFileId(null);
    setAnalysisData(null);
    onClearFile();
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

  // 兼容旧版本的sampleData和新版本的samplePreview
  const getSampleData = (data: any) => {
    if (!data) return [];
    return data.samplePreview || data.sampleData || [];
  };

  // 防止hydration错误，在客户端加载完成前不渲染
  if (!isClient) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    )
  }

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

      {/* 当前文件状态 */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">当前文件</h3>
          </div>
          <div className="p-4">
            {/* 显示活跃文件或正在处理的文件 */}
            {(() => {
              // 如果有文件在数组中，显示文件信息
              if (files.length > 0) {
                // 优先显示活跃文件
                const activeFile = files.find(f => f.id === activeFileId);
                // 如果没有活跃文件，显示第一个正在处理的文件
                const processingFile = files.find(f => f.status === 'processing' || f.status === 'uploading');
                const displayFile = activeFile || processingFile || files[files.length - 1];
                
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {displayFile.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(displayFile.file.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {displayFile.status === 'uploading' && (
                          <>
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${displayFile.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {displayFile.progress}%
                            </span>
                          </>
                        )}
                        {displayFile.status === 'processing' && (
                          <>
                            <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
                            <span className="text-xs text-yellow-600">
                              处理中 {displayFile.progress}%
                            </span>
                          </>
                        )}
                        {displayFile.status === 'completed' && (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-xs text-green-600">分析完成</span>
                          </>
                        )}
                        {displayFile.status === 'failed' && (
                          <>
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-xs text-red-600">
                              {displayFile.error || '处理失败'}
                            </span>
                          </>
                        )}
                      </div>
                      {(displayFile.status === 'completed' || displayFile.status === 'failed') && (
                        <button
                          onClick={() => removeFile(displayFile.id)}
                          className="text-gray-400 hover:text-gray-600"
                          title="移除文件"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              } else if (activeFileId && analysisData) {
                // 如果没有文件但有分析数据（页面刷新后恢复的情况）
                return (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {analysisData.fileName || '恢复的文件'}
                        </p>
                        <p className="text-xs text-gray-500">
                          页面刷新后恢复
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-green-600">分析完成</span>
                      </div>
                      <button
                        onClick={() => removeFile(activeFileId)}
                        className="text-gray-400 hover:text-gray-600"
                        title="移除文件"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      )}

      {/* 分析结果 - 只在有活跃文件时显示 */}
      {console.log('[DEBUG] Render check:', { 
        analysisData: !!analysisData, 
        activeFileId, 
        files: files.map(f => ({ id: f.id, status: f.status })),
        samplePreviewLength: analysisData ? getSampleData(analysisData).length : 0,
        condition: files.length === 0 || files.some(f => f.id === activeFileId && f.status === 'completed')
      })}
      {analysisData && activeFileId && (files.length === 0 || files.some(f => f.id === activeFileId && f.status === 'completed')) && (
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
                  <div key={item.name} className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-500 w-8">#{index + 1}</span>
                      <span className="text-sm text-gray-900 truncate" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right ml-4">
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
                  <div key={item.name} className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <span className="text-sm font-medium text-gray-500 w-8">#{index + 1}</span>
                      <span className="text-sm text-gray-900 truncate">{item.name}</span>
                    </div>
                    <div className="text-right ml-4">
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
            <h4 className="text-md font-medium text-gray-900 mb-4">数据样本 (前100行)</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">网站</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">国家</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">广告格式</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">广告单元</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">广告客户</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">域名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">设备</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">浏览器</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">请求数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">展示数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">点击数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">点击率</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">eCPM</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">收入</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">可见展示</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">可见率</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">可衡量展示</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">填充率</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ARPU</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getSampleData(analysisData).slice(0, 50).map((row: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.date || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.website}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.country}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.adFormat}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.adUnit || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.advertiser || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.domain || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.device}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.browser || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatNumber(row.requests)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatNumber(row.impressions)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatNumber(row.clicks)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{(row.ctr * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">¥{row.ecpm.toFixed(2)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">¥{row.revenue.toFixed(2)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatNumber(row.viewableImpressions)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.viewabilityRate?.toFixed(2)}%</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatNumber(row.measurableImpressions)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.fillRate !== undefined ? row.fillRate.toFixed(2) + '%' : (row.requests > 0 ? ((row.impressions / row.requests) * 100).toFixed(2) + '%' : '-')}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.arpu !== undefined ? '¥' + row.arpu.toFixed(2) : (row.requests > 0 ? '¥' + (row.revenue / row.requests).toFixed(2) : '-')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {getSampleData(analysisData).length > 50 && (
              <div className="mt-4 text-center text-sm text-gray-500">
                显示前50行，共{getSampleData(analysisData).length}行样本数据
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadOptimized;