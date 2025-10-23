const fs = require('fs');
const path = require('path');

class ConfigLoader {
    constructor(instancePath = null) {
        this.currentConfig = null;
        // Use shared config.json file from the shared/config directory
        this.configPath = path.join(__dirname, 'config.json');
    }

    /**
     * Load the configuration file for the specific instance
     * @returns {Object} The loaded configuration
     */
    loadConfig() {
        try {
            // Return cached config if already loaded
            if (this.currentConfig) {
                return this.currentConfig;
            }

            // Load config from instance-specific file
            if (!fs.existsSync(this.configPath)) {
                throw new Error(`Configuration file not found at: ${this.configPath}`);
            }

            const configData = fs.readFileSync(this.configPath, 'utf8');
            const config = JSON.parse(configData);
            
            // Cache the config
            this.currentConfig = config;
            
            console.log(`✅ Configuration loaded from: ${this.configPath}`);
            return config;
            
        } catch (error) {
            console.error('❌ Error loading configuration:', error.message);
            throw error;
        }
    }

    /**
     * Get a message from the configuration with variable substitution
     * @param {string} messagePath - Dot notation path to the message (e.g., 'messages.welcome.initial')
     * @param {Object} variables - Variables to substitute in the message
     * @returns {string} The formatted message
     */
    getMessage(messagePath, variables = {}) {
        if (!this.currentConfig) {
            throw new Error('No configuration loaded. Call loadConfig() first.');
        }

        const message = this.getNestedValue(this.currentConfig, messagePath);
        if (!message) {
            console.warn(`Message not found at path: ${messagePath}`);
            return 'Message not found';
        }

        return this.substituteVariables(message, variables);
    }

    /**
     * Get a specific number/setting from the configuration
     * @param {string} numberPath - Dot notation path to the number
     * @returns {number} The configuration number
     */
    getNumber(numberPath) {
        if (!this.currentConfig) {
            throw new Error('No configuration loaded. Call loadConfig() first.');
        }

        const number = this.getNestedValue(this.currentConfig, numberPath);
        if (number === undefined || number === null) {
            console.warn(`Number not found at path: ${numberPath}`);
            return 0;
        }

        return number;
    }

    /**
     * Reload configuration
     */
    reloadConfig() {
        this.currentConfig = null;
        return this.loadConfig();
    }

    /**
     * Helper method to get nested object values using dot notation
     * @private
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Helper method to substitute variables in messages
     * @private
     */
    substituteVariables(message, variables) {
        let result = message;
        
        // Add business info to variables for substitution
        const allVariables = {
            ...variables,
            companyName: this.currentConfig?.businessInfo?.companyName || 'Our Company'
        };

        // Replace variables in format {variableName}
        Object.keys(allVariables).forEach(key => {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            result = result.replace(regex, allVariables[key]);
        });

        return result;
    }
}

module.exports = ConfigLoader;