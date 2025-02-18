const { execSync } = require('child_process');
const { unlinkSync } = require('fs');

class EncryptionService {
    constructor(config) {
        this.config = config;
    }

    async encryptFile(inputFile) {
        if (!this.config.encryptionPassword || this.config.encryptionPassword === '**None**') {
            return inputFile;
        }

        const outputFile = `${inputFile}.enc`;
        console.log(`Encrypting ${inputFile}`);

        try {
            execSync(`openssl enc -aes-256-cbc -pbkdf2 -in "${inputFile}" -out "${outputFile}" -k "${this.config.encryptionPassword}"`);
            unlinkSync(inputFile);
            return outputFile;
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }
}

module.exports = EncryptionService;