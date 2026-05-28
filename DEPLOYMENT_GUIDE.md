# Backend Deployment Guide

## Recent Changes

### Photo Upload Feature
Added new endpoint for venue photo uploads using Cloudinary.

**Files Modified:**
- `config/cloudinary.js` - Added venue photo storage configuration
- `routes/vendor/venues.js` - Added upload-photo route
- `controllers/vendor/venuesController.js` - Added uploadPhoto controller

## Deployment Steps

### Option 1: Git Push (Recommended for Render)

```bash
cd DrinkBuddy-Backend
git add .
git commit -m "Add venue photo upload endpoint"
git push origin main
```

Render will automatically detect the changes and redeploy.

### Option 2: Manual Restart

If you have access to the Render dashboard:
1. Go to your service on Render
2. Click "Manual Deploy" → "Deploy latest commit"
3. Wait for deployment to complete

### Option 3: Local Testing

Before deploying, test locally:

```bash
cd DrinkBuddy-Backend
npm install
npm start
```

Test the upload endpoint:
```bash
curl -X POST \
  http://localhost:5000/api/vendor/venues/{venueId}/upload-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "photo=@/path/to/image.jpg"
```

## Environment Variables

Ensure these are set in Render:

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Verification

After deployment, verify the endpoint is working:

1. Check Render logs for any errors
2. Test the upload from the frontend
3. Verify images appear in Cloudinary dashboard

## Troubleshooting

### 404 Error
- **Cause**: Route not registered or server not restarted
- **Solution**: Redeploy or restart the server

### 500 Error
- **Cause**: Cloudinary credentials missing or invalid
- **Solution**: Check environment variables in Render

### Multer Error
- **Cause**: File size too large or invalid file type
- **Solution**: Check file validation in cloudinary.js

## Rollback

If issues occur, rollback to previous version:

```bash
git revert HEAD
git push origin main
```

Or in Render dashboard:
1. Go to "Deploys" tab
2. Find previous successful deploy
3. Click "Redeploy"

---

**Note**: The frontend has a fallback mechanism using ImgBB, so photo uploads will work even if the backend endpoint is not deployed yet.
