const fs = require('fs');
const path = require('path');
const {
  cloudinary,
  isCloudinaryConfigured,
  cloudinaryFolders,
  getCloudinaryUploadOptions,
} = require('../services/cloudinary.service');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const IMAGE_DIR = path.join(ROOT_DIR, 'frontend', 'public', 'assessment-images');
const MANIFEST_PATH = path.join(IMAGE_DIR, 'manifest.json');
const CLOUDINARY_MANIFEST_PATH = path.join(IMAGE_DIR, 'cloudinary-manifest.json');

const listImageFiles = (baseDir) => {
  const results = [];

  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) {
        results.push(fullPath);
      }
    }
  };

  walk(baseDir);

  return results.sort();
};

const loadManifest = () => {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {
      generatedAt: new Date().toISOString(),
      total: 0,
      categories: {},
      images: {},
    };
  }

  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (error) {
    return {
      generatedAt: new Date().toISOString(),
      total: 0,
      categories: {},
      images: {},
    };
  }
};

const main = async () => {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary is not configured. Add CLOUDINARY_* env vars in backend/.env');
  }

  if (!fs.existsSync(IMAGE_DIR)) {
    throw new Error(`Image directory not found: ${IMAGE_DIR}`);
  }

  const files = listImageFiles(IMAGE_DIR);

  if (!files.length) {
    throw new Error('No local assessment images found to upload.');
  }

  const manifest = loadManifest();
  const uploaded = {};

  console.log(`Uploading ${files.length} files to Cloudinary...`);

  for (const absolutePath of files) {
    const relativePath = path.relative(IMAGE_DIR, absolutePath).replace(/\\/g, '/');
    const publicId = `assessment-images/${relativePath.replace(/\.[^.]+$/, '')}`;

    const baseOptions = getCloudinaryUploadOptions('asset');
    const uploadOptions = {
      ...baseOptions,
      folder: `${cloudinaryFolders.assets}/assessment-images`,
      public_id: publicId,
      overwrite: true,
      use_filename: false,
      unique_filename: false,
      resource_type: 'image',
    };

    const response = await cloudinary.uploader.upload(absolutePath, uploadOptions);

    uploaded[relativePath] = {
      public_id: response.public_id,
      secure_url: response.secure_url,
      url: response.url,
      width: response.width,
      height: response.height,
      format: response.format,
      bytes: response.bytes,
      uploaded_at: new Date().toISOString(),
      local_path: `/assessment-images/${relativePath}`,
    };

    if (!manifest.images[relativePath]) {
      const category = relativePath.split('/')[0] || 'professional-workplace';
      manifest.images[relativePath] = {
        filename: path.basename(relativePath),
        local_path: `/assessment-images/${relativePath}`,
        category,
      };
    }

    manifest.images[relativePath].cloudinary_url = response.url;
    manifest.images[relativePath].secure_url = response.secure_url;

    console.log(`uploaded ${relativePath}`);
  }

  manifest.generatedAt = new Date().toISOString();
  manifest.total = files.length;

  const cloudinaryManifest = {
    generatedAt: new Date().toISOString(),
    folder: `${cloudinaryFolders.assets}/assessment-images`,
    total: Object.keys(uploaded).length,
    images: uploaded,
  };

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(CLOUDINARY_MANIFEST_PATH, `${JSON.stringify(cloudinaryManifest, null, 2)}\n`, 'utf8');

  console.log(`Cloudinary manifest saved at ${CLOUDINARY_MANIFEST_PATH}`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
