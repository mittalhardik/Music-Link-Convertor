# Google Cloud Build Deployment Guide

This guide will help you deploy the Music Link Converter app to Google Cloud Platform using Cloud Build and Cloud Run.

## Prerequisites

1. **Google Cloud Project**: You need a Google Cloud project with billing enabled
2. **Google Cloud CLI**: Install and configure the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
3. **Required APIs**: Enable the following APIs in your project:
   - Cloud Build API
   - Cloud Run API
   - Container Registry API

## Setup Instructions

### 1. Enable Required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 2. Set Up Environment Variables

Create a `.env` file in your project root (or set them in Cloud Run):

```bash
# Copy the example file
cp env.example .env

# Edit the .env file with your actual Spotify API credentials
# Get these from https://developer.spotify.com/dashboard
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
NODE_ENV=production
PORT=3000
```

### 3. Grant Cloud Build Permissions

```bash
# Get your project ID
PROJECT_ID=$(gcloud config get-value project)

# Grant Cloud Build the Cloud Run Admin role
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$PROJECT_ID@cloudbuild.gserviceaccount.com" \
    --role="roles/run.admin"

# Grant Cloud Build the IAM Service Account User role
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$PROJECT_ID@cloudbuild.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"
```

### 4. Deploy Using Cloud Build

#### Option A: Deploy from local repository

```bash
# Submit the build to Cloud Build
gcloud builds submit --config cloudbuild.yaml .
```

#### Option B: Deploy from GitHub (Recommended for CI/CD)

1. Connect your GitHub repository to Cloud Build:
   - Go to Cloud Build > Triggers in the Google Cloud Console
   - Click "Create Trigger"
   - Connect your GitHub repository
   - Set the trigger to run on push to main branch
   - Use the `cloudbuild.yaml` file as the build configuration

2. Push your code to trigger the build:
```bash
git add .
git commit -m "Prepare for Cloud Build deployment"
git push origin main
```

### 5. Set Environment Variables in Cloud Run

After deployment, set your environment variables in Cloud Run:

```bash
gcloud run services update music-link-converter \
    --set-env-vars SPOTIFY_CLIENT_ID=your_spotify_client_id,SPOTIFY_CLIENT_SECRET=your_spotify_client_secret,NODE_ENV=production \
    --region us-central1
```

### 6. Access Your Application

Once deployed, you'll get a URL like:
```
https://music-link-converter-xxxxxxxx-uc.a.run.app
```

## Configuration Options

### Customizing the Deployment

You can modify the `cloudbuild.yaml` file to:

- Change the region (currently `us-central1`)
- Adjust memory and CPU allocation
- Modify the maximum number of instances
- Add custom environment variables
- Change the service name

### Environment Variables

The following environment variables can be set in Cloud Run:

- `SPOTIFY_CLIENT_ID`: Your Spotify API client ID
- `SPOTIFY_CLIENT_SECRET`: Your Spotify API client secret
- `NODE_ENV`: Set to `production` for production deployment
- `PORT`: The port the app runs on (default: 3000)

## Monitoring and Logs

- **View logs**: `gcloud logs tail --service=music-link-converter`
- **Monitor performance**: Use Cloud Run metrics in the Google Cloud Console
- **Set up alerts**: Configure Cloud Monitoring alerts for your service

## Troubleshooting

### Common Issues

1. **Build fails**: Check that all required APIs are enabled
2. **Permission denied**: Ensure Cloud Build has the necessary IAM roles
3. **Environment variables not set**: Verify they're configured in Cloud Run
4. **App not responding**: Check the logs for errors

### Useful Commands

```bash
# View service details
gcloud run services describe music-link-converter --region us-central1

# Update the service
gcloud run services update music-link-converter --image gcr.io/PROJECT_ID/music-link-converter:COMMIT_SHA --region us-central1

# Delete the service (if needed)
gcloud run services delete music-link-converter --region us-central1
```

## Cost Optimization

- The app is configured to scale to zero when not in use
- Maximum instances are limited to 10 to control costs
- Memory is set to 512Mi which is sufficient for this app
- Consider setting up budget alerts in Google Cloud Console 