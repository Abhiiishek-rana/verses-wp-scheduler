const fs = require('fs');
const path = require('path');
const { pipeline } = require('@xenova/transformers');
const moment = require('moment');

/**
 * Shared utility functions for WhatsApp bot instances
 */
class BotUtils {
    constructor() {
        this.sentimentAnalyzer = null;
        this.timeParsingLLM = null;
    }

    /**
     * Initialize AI models (shared across instances)
     */
    async initializeAIModels() {
        try {
            console.log('🤖 Initializing shared AI models...');
            
            // Initialize modern Twitter-trained sentiment analysis model
            this.sentimentAnalyzer = await pipeline('text-classification', 'Xenova/twitter-roberta-base-sentiment-latest');
            console.log('✅ Modern Twitter-trained sentiment analysis model loaded (RoBERTa)');
            
            // Initialize TinyLlama for intelligent date/time parsing
            this.timeParsingLLM = await pipeline('text-generation', 'Xenova/TinyLlama-1.1B-Chat-v1.0');
            console.log('✅ TinyLlama model loaded for intelligent date/time parsing');
            
        } catch (error) {
            console.error('❌ Error initializing AI models:', error);
            // Fallback to simple keyword-based analysis
            console.log('🔄 Using fallback keyword-based analysis and regex time parsing');
        }
    }

    /**
     * Extract phone number from WhatsApp ID
     */
    extractPhoneNumber(whatsappId) {
        return whatsappId.split('@')[0];
    }

    /**
     * Create delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Load JSON file safely
     */
    loadJsonFile(filePath, defaultValue = {}) {
        try {
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            }
            return defaultValue;
        } catch (error) {
            console.error(`❌ Error loading JSON file ${filePath}:`, error);
            return defaultValue;
        }
    }

    /**
     * Save JSON file safely
     */
    saveJsonFile(filePath, data) {
        try {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error(`❌ Error saving JSON file ${filePath}:`, error);
            return false;
        }
    }

    /**
     * Format date consistently
     */
    formatDate(day, month, year) {
        return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
    }

    /**
     * Check if date/time is in the past
     */
    isDateTimeInPast(date, time, currentDateTime = new Date(), originalText = '') {
        try {
            const [day, month, year] = date.split('/').map(Number);
            const [hours, minutes] = time.split(':').map(Number);
            
            const scheduledDateTime = new Date(year, month - 1, day, hours, minutes);
            const isPast = scheduledDateTime <= currentDateTime;
            
            if (isPast) {
                console.log(`⚠️ Scheduled time is in the past: ${scheduledDateTime} vs current: ${currentDateTime}`);
                console.log(`📝 Original text: "${originalText}"`);
            }
            
            return isPast;
        } catch (error) {
            console.error('❌ Error checking if datetime is in past:', error);
            return false;
        }
    }

    /**
     * Get next occurrence of a weekday
     */
    getNextWeekday(now, targetDay) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDayIndex = days.indexOf(targetDay.toLowerCase());
        const currentDayIndex = now.getDay();
        const daysUntilTarget = (targetDayIndex - currentDayIndex + 7) % 7 || 7;
        
        const nextDate = new Date(now);
        nextDate.setDate(now.getDate() + daysUntilTarget);
        return nextDate;
    }

    /**
     * Setup graceful shutdown for process
     */
    setupGracefulShutdown(client, sessionManager, instanceName = 'Bot') {
        const gracefulShutdown = async (signal) => {
            console.log(`\n🔄 ${instanceName} received ${signal}. Performing graceful shutdown...`);
            
            try {
                if (sessionManager && typeof sessionManager.forceSave === 'function') {
                    console.log('💾 Saving sessions before shutdown...');
                    await sessionManager.forceSave();
                }
                
                if (client && typeof client.destroy === 'function') {
                    console.log('🔌 Closing WhatsApp client...');
                    await client.destroy();
                }
                
                console.log(`✅ ${instanceName} shutdown completed gracefully`);
                process.exit(0);
            } catch (error) {
                console.error(`❌ Error during ${instanceName} shutdown:`, error);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
    }

    /**
     * Setup error handlers
     */
    setupErrorHandlers(instanceName = 'Bot') {
        process.on('uncaughtException', (error) => {
            console.error(`❌ ${instanceName} uncaught exception:`, error);
            console.error('Stack trace:', error.stack);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error(`❌ ${instanceName} unhandled rejection at:`, promise, 'reason:', reason);
        });
    }
}

module.exports = new BotUtils();