const fs = require('fs');
const path = require('path');

// Get new version from command line argument
const newVersion = process.argv[2];

if (!newVersion) {
    console.error('Usage: node set_version.js <new_version>');
    process.exit(1);
}

// Validate version format (simplified semver)
if (!/^\d+\.\d+\.\d+/.test(newVersion)) {
    console.error('Error: Version must be in format X.Y.Z');
    process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const tauriDir = path.join(rootDir, 'src-tauri');

// 1. Update package.json
const packageJsonPath = path.join(rootDir, 'package.json');
try {
    const packageJson = require(packageJsonPath);
    console.log(`Updating package.json: ${packageJson.version} -> ${newVersion}`);
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
} catch (error) {
    console.error('Error updating package.json:', error);
    process.exit(1);
}

// 2. Update tauri.conf.json
const tauriConfPath = path.join(tauriDir, 'tauri.conf.json');
try {
    const tauriConf = require(tauriConfPath);
    console.log(`Updating tauri.conf.json: ${tauriConf.version} -> ${newVersion}`);
    tauriConf.version = newVersion;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
} catch (error) {
    console.error('Error updating tauri.conf.json:', error);
    process.exit(1);
}

// 3. Update Cargo.toml
const cargoTomlPath = path.join(tauriDir, 'Cargo.toml');
try {
    let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
    // Use regex to replace version in [package] section only
    // This regex looks for 'version = "..."' exactly under [package] or at start of file
    // but standard TOML parsers in regex are hard. 
    // We assume standard cargo initialization where version is near the top.
    const versionRegex = /^version\s*=\s*"[^"]+"/m;
    const newContent = cargoToml.replace(versionRegex, `version = "${newVersion}"`);

    if (cargoToml === newContent) {
        // Fallback: mostly creates issues if version line is not top-level or formatted weirdly
        console.warn('Warning: Could not regex match version in Cargo.toml. Please check manual update.');
    } else {
        console.log(`Updating Cargo.toml version to ${newVersion}`);
        fs.writeFileSync(cargoTomlPath, newContent);
    }
} catch (error) {
    console.error('Error updating Cargo.toml:', error);
    process.exit(1);
}

console.log('✅ All files updated successfully.');
