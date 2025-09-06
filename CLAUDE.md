# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Google ADX Optimization System - a data analytics platform for optimizing Google Ad Exchange advertising revenue. The system processes large CSV files containing ad performance data and provides comprehensive analytics and visualization tools.

## Key Development Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Database Operations
```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes to database
npm run db:migrate   # Run database migrations
```

### Docker
```bash
docker build -t google-adx-optimization .  # Build container
```

## Architecture Overview

### Technology Stack
- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Charts**: Recharts for data visualization
- **File Upload**: react-dropzone

### Database Schema
The main `AdReport` model includes:
- **Temporal**: `dataDate`, `uploadDate`
- **Geographic**: `country`, `website`, `domain`
- **Technical**: `device`, `browser`, `adFormat`, `adUnit`
- **Performance**: `requests`, `impressions`, `clicks`, `ctr`, `ecpm`, `revenue`
- **Analytics**: `viewableImpressions`, `viewabilityRate`, `fillRate`, `arpu`

### Key Components
1. **Upload.tsx**: Drag-and-drop CSV uploader with progress tracking
2. **DataTable.tsx**: Paginated, searchable, sortable data table
3. **Analytics.tsx**: Dashboard with charts and insights

### API Endpoints
- `/api/upload`: Stream-based CSV processing with batch insertion
- `/api/data`: Paginated data retrieval with search/filter
- `/api/analytics`: Aggregated analytics for charts

## Important Implementation Details

### File Processing
- Uses stream processing for large CSV files (up to 50MB)
- Batch inserts data in chunks of 1000 records
- Flexible CSV parsing supports various column naming conventions
- Required fields: Date, Website

### Database Initialization
- Automatic schema creation on startup (self-healing)
- Prisma binary target optimized for Alpine Linux with OpenSSL 3.0.x
- Global singleton pattern for Prisma client

### Performance Optimizations
- Strategic indexing on date, website, and country fields
- Connection pooling and batch operations
- Next.js standalone build for containerized deployment

### Environment Configuration
- Development: localhost
- Production: moretop10.com (auto-redirects to www.moretop10.com)
- Container registry: ghcr.io/xxrenzhe/google_adx_optimization:prod-latest

## CSV Data Format

The system expects CSV files with ad performance data. Required columns:
- **Date**: The date of the ad performance data
- **Website**: The website/domain where ads were displayed

Optional columns include Country, Device, Ad Format, Requests, Impressions, Clicks, Revenue, and various metrics.

## Deployment

The project is configured for automatic deployment:
- Push to main branch triggers Docker build
- Images pushed to GitHub Container Registry
- Production deployment on moretop10.com