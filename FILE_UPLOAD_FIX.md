# File Upload Progress Display Fix

## Problem
After users uploaded a file, the frontend showed "分析中..." (analyzing...) with "已处理:0行" (processed: 0 rows), but the backend logs showed the file had been completely processed. This broke user trust in the system.

## Root Cause
The issue was a file ID mismatch between the frontend and backend:

1. **Frontend** generated a fileId using `crypto.randomUUID()` when the user selected a file
2. **Backend** generated its own fileId using `crypto.randomUUID()` when processing the upload
3. **Frontend** ignored the backend's fileId and used its own for polling
4. This caused the frontend to poll for status with a fileId that didn't exist on the backend

## Solution
Fixed the file upload flow in `components/FileUploader.tsx`:

1. Frontend still generates a temporary fileId for the upload
2. After upload, frontend retrieves the actual fileId from the backend response
3. Frontend remaps the file data to use the backend's fileId
4. Frontend clears the temporary fileId
5. Frontend uses the backend's fileId for all subsequent status polling

## Key Changes
```typescript
// Before: Used frontend-generated fileId
onUploadComplete?.(fileId)

// After: Use backend-generated fileId
const serverFileId = result.fileId

// Remap file to server fileId
const existingFile = useUploadStore.getState().getFile(fileId)
if (existingFile) {
  setFile(serverFileId, { ...existingFile, id: serverFileId })
  useUploadStore.getState().clearFile(fileId)
}

onUploadComplete?.(serverFileId)
```

## Verification
- ✅ Backend correctly generates and returns fileId
- ✅ Status polling now works with the correct fileId
- ✅ Frontend shows accurate progress and completion status
- ✅ User trust is restored as progress is properly displayed

## Impact
This fix ensures that:
1. Users see accurate upload progress
2. The processing status is correctly displayed
3. Users can trust that their files are being processed
4. The system provides proper feedback throughout the upload process