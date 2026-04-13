const { v2: cloudinary } = require('cloudinary');
const { config } = require('../config/env');

const cloudinaryFolders = {
  cvUploads: config.cloudinary.folders.cvUploads,
  generatedPdfReports: config.cloudinary.folders.generatedPdfReports,
  assets: config.cloudinary.folders.assets,
};

const isCloudinaryConfigured = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

const getCloudinaryUploadOptions = (resourceType = 'asset') => {
  if (resourceType === 'cv') {
    return {
      folder: cloudinaryFolders.cvUploads,
      resource_type: 'raw',
      overwrite: false,
    };
  }

  if (resourceType === 'pdf') {
    return {
      folder: cloudinaryFolders.generatedPdfReports,
      resource_type: 'raw',
      format: 'pdf',
      overwrite: true,
    };
  }

  return {
    folder: cloudinaryFolders.assets,
    resource_type: 'auto',
    overwrite: false,
  };
};

module.exports = {
  cloudinary,
  cloudinaryFolders,
  isCloudinaryConfigured,
  getCloudinaryUploadOptions,
};
