const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { pipeline } = require('@xenova/transformers');
const moment = require('moment');
const ConfigLoader = require('../shared/config/configLoader');
const botUtils = require('../shared/utils/botUtils');

// Initialize config loader for this instance
const config = new ConfigLoader(__dirname);

// File paths
const TARGET_NUMBERS_FILE = path.join(__dirname, 'target_numbers.json');
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
const CALL_SCHEDULE_FILE = path.join(__dirname, 'call_schedule.json');

// Initialize configuration
config.loadConfig();
console.log('📋 Configuration loaded successfully');

// AI Models for sentiment analysis and time parsing
let sentimentAnalyzer = null;
let timeParsingLLM = null;

// Initialize AI models
async function initializeAIModels() {
  try {
    console.log('🤖 Initializing AI models...');
    
    // Initialize modern Twitter-trained sentiment analysis model
    sentimentAnalyzer = await pipeline('text-classification', 'Xenova/twitter-roberta-base-sentiment-latest');
    console.log('✅ Modern Twitter-trained sentiment analysis model loaded (RoBERTa)');
    
    // Initialize TinyLlama for intelligent date/time parsing
    timeParsingLLM = await pipeline('text-generation', 'Xenova/TinyLlama-1.1B-Chat-v1.0');
    console.log('✅ TinyLlama model loaded for intelligent date/time parsing');
    
  } catch (error) {
    console.error('❌ Error initializing AI models:', error);
    // Fallback to simple keyword-based analysis
    console.log('🔄 Using fallback keyword-based analysis and regex time parsing');
  }
}

// Sentiment analysis function with modern Twitter-trained model
async function analyzeSentiment(text, context = 'general') {
  try {
    if (!sentimentAnalyzer) {
      console.log('⚠️ Sentiment analyzer not loaded, using keyword fallback');
      return analyzeKeywordSentiment(text, context);
    }
    
    // Clean and prepare text for analysis (preserve original case for Twitter model)
    const cleanText = text.trim();
    
    // Use Twitter-trained AI model for sentiment analysis
    const result = await sentimentAnalyzer(cleanText);
    const sentiment = result[0];
    
    // Twitter RoBERTa model labels: LABEL_0 = Negative, LABEL_1 = Neutral, LABEL_2 = Positive
    let sentimentLabel = 'neutral';
    if (sentiment.label === 'LABEL_2') {
      sentimentLabel = 'positive';
    } else if (sentiment.label === 'LABEL_0') {
      sentimentLabel = 'negative';
    } else if (sentiment.label === 'LABEL_1') {
      sentimentLabel = 'neutral';
    }
    
    console.log(`🤖 Twitter AI Sentiment: "${cleanText}" -> ${sentimentLabel.toUpperCase()} (${sentiment.score.toFixed(3)})`);
    
    // For yes/no questions, we need to interpret sentiment in context
    if (context === 'yes_no_question') {
      return interpretYesNoSentiment(cleanText, { label: sentimentLabel, score: sentiment.score });
    }
    
    // For general sentiment analysis with confidence thresholds
    if (sentimentLabel === 'positive' && sentiment.score > 0.6) {
      return 'positive';
    } else if (sentimentLabel === 'negative' && sentiment.score > 0.6) {
      return 'negative';
    } else {
      // For uncertain cases or low confidence, use enhanced keyword analysis as backup
      const keywordResult = analyzeKeywordSentiment(text, context);
      if (keywordResult !== 'neutral') {
        console.log(`🔄 Using keyword backup: ${keywordResult} (AI confidence: ${sentiment.score.toFixed(3)})`);
        return keywordResult;
      }
      return 'neutral';
    }
  } catch (error) {
    console.error('❌ Error in AI sentiment analysis:', error);
    return analyzeKeywordSentiment(text, context);
  }
}

// Interpret sentiment specifically for yes/no questions
function interpretYesNoSentiment(text, aiSentiment) {
  // Direct yes/no indicators
  const yesPatterns = /\b(yes|yeah|yep|sure|okay|ok|fine|good|great|absolutely|definitely|of course|certainly|right|correct|true|agree|accept|interested|want|would like|sounds good|let's do it|count me in)\b/i;
  const noPatterns = /\b(no|nope|nah|not|never|refuse|decline|reject|disagree|don't|won't|can't|shouldn't|wouldn't|uninterested|not interested|not really|maybe not|probably not)\b/i;
  
  // Check for explicit patterns first
  if (yesPatterns.test(text)) {
    return 'positive';
  }
  if (noPatterns.test(text)) {
    return 'negative';
  }
  
  // Use AI sentiment with context - only trust clear negative signals
  if (aiSentiment.label === 'negative' && aiSentiment.score > 0.7) {
    return 'negative';
  }
  
  // For ambiguous, uncertain, or complex expressions - default to positive (yes)
  // This includes cases like "hmm", "maybe", "I guess", "not sure", etc.
  console.log(`🔄 Ambiguous/complex expression "${text}" interpreted as YES (positive)`);
  return 'positive';
}

// Enhanced keyword-based sentiment analysis with context awareness
function analyzeKeywordSentiment(text, context = 'general') {
  const lowerText = text.toLowerCase().trim();
  
  console.log(`🔤 Keyword Analysis: "${lowerText}" (context: ${context})`);
  
  // Context-specific patterns
  if (context === 'yes_no_question') {
    return analyzeYesNoKeywords(lowerText);
  }
  
  // General positive indicators
  const positivePatterns = [
    /\b(yes|yeah|yep|yup|sure|okay|ok|fine|good|great|excellent|awesome|fantastic|wonderful|amazing|perfect|love|like|enjoy|happy|excited|interested|want|would like|sounds good|let's do it|count me in|absolutely|definitely|of course|certainly|right|correct|true|agree|accept)\b/i,
    /\b(👍|😊|😄|😃|🙂|👌|✅|💯)\b/g // Emoji patterns
  ];
  
  // General negative indicators
  const negativePatterns = [
    /\b(no|nope|nah|not|never|refuse|decline|reject|disagree|don't|won't|can't|shouldn't|wouldn't|hate|dislike|bad|terrible|awful|horrible|worst|uninterested|not interested|not really|maybe not|probably not)\b/i,
    /\b(👎|😞|😢|😠|😡|❌|🚫)\b/g // Negative emoji patterns
  ];
  
  // Uncertainty indicators
  const uncertaintyPatterns = [
    /\b(maybe|perhaps|might|could|possibly|not sure|don't know|uncertain|thinking|considering|let me think|hmm|uh|um)\b/i,
    /\b(🤔|😐|😕|🤷)\b/g // Uncertain emoji patterns
  ];
  
  // Check patterns in order of specificity
  for (const pattern of positivePatterns) {
    if (pattern.test(lowerText)) {
      console.log(`✅ Positive keyword match: ${pattern}`);
      return 'positive';
    }
  }
  
  for (const pattern of negativePatterns) {
    if (pattern.test(lowerText)) {
      console.log(`❌ Negative keyword match: ${pattern}`);
      return 'negative';
    }
  }
  
  for (const pattern of uncertaintyPatterns) {
    if (pattern.test(lowerText)) {
      console.log(`❓ Uncertainty keyword match: ${pattern}`);
      return 'neutral';
    }
  }
  
  console.log(`➡️ No keyword matches found, returning neutral`);
  return 'neutral';
}

// Enhanced comprehensive analysis for yes/no questions
function analyzeYesNoKeywords(text) {
  const lowerText = text.toLowerCase().trim();
  
  // Strong affirmative responses (high confidence)
  const strongYes = /\b(yes|yeah|yep|yup|absolutely|definitely|of course|certainly|sure thing|for sure|count me in|let's do it|sounds good|i'm in|i want|i would like|interested|please|go ahead|perfect|excellent|great|awesome|fantastic)\b/i;
  
  // Casual/Slang affirmatives
  const casualYes = /\b(ya|yea|yas|yass|bet|word|cool|dope|lit|fire|sick|tight|right on|fo sho|fo sure|hell yeah|hell yes|damn right|you bet|totally|100%|💯)\b/i;
  
  // Multilingual affirmatives
  const multilingualYes = /\b(si|sí|oui|ja|da|hai|haan|sim|igen|tak|ano)\b/i;
  
  // Strong negative responses (high confidence)
  const strongNo = /\b(no|nope|nah|never|not interested|don't want|won't|can't|refuse|decline|reject|not really|probably not|maybe not|absolutely not|definitely not|hell no|no way|not happening|forget it|not a chance)\b/i;
  
  // Casual/Slang negatives
  const casualNo = /\b(naw|nuh|nuh-uh|nu-uh|nada|zilch|zip|zero|not gonna|ain't|nope nope|hard pass|pass|skip|next|not feeling it|meh)\b/i;
  
  // Multilingual negatives
  const multilingualNo = /\b(non|nein|nyet|nahi|não|nem|nie|ne|iie)\b/i;
  
  // Conditional/uncertain responses
  const conditional = /\b(maybe|perhaps|might|could|possibly|not sure|don't know|let me think|thinking about it|considering|depends|we'll see|i'll think about it|let me check|need to check|unsure|uncertain|on the fence|torn|conflicted)\b/i;
  
  // Polite affirmatives (medium confidence)
  const politeYes = /\b(okay|ok|fine|good|alright|that works|sounds fine|i guess|why not|sure|sounds reasonable|acceptable|works for me|that's fine|no problem|no worries)\b/i;
  
  // Polite negatives (medium confidence)
  const politeNo = /\b(sorry but no|i'm afraid not|not this time|not right now|maybe another time|not today|i'll pass|thanks but no|appreciate it but|kind of you but)\b/i;
  
  // Enthusiastic responses
  const enthusiastic = /\b(love it|love to|can't wait|excited|thrilled|pumped|stoked|hyped|down|i'm down|let's go|bring it on)\b/i;
  
  // Reluctant responses
  const reluctant = /\b(i suppose|if i have to|if you insist|reluctantly|hesitant|not thrilled|not excited|meh|whatever|if i must)\b/i;
  
  // Emoji patterns
  const positiveEmojis = /👍|👌|✅|😊|😄|😃|😁|🙂|😉|💪|🔥|💯|❤️|💚|💙/g;
  const negativeEmojis = /👎|❌|😞|😔|😕|🙁|😒|😤|💔|😢|😭|🚫|⛔/g;
  const neutralEmojis = /🤔|😐|😑|🤷|🤷‍♂️|🤷‍♀️|❓|❔/g;
  
  // Check in order of confidence (highest to lowest)
  
  // Check for enthusiastic responses first
  if (enthusiastic.test(lowerText)) {
    console.log(`🎉 Enthusiastic YES detected`);
    return 'positive';
  }
  
  // Check strong responses
  if (strongYes.test(lowerText)) {
    console.log(`✅ Strong YES detected`);
    return 'positive';
  }
  
  if (strongNo.test(lowerText)) {
    console.log(`❌ Strong NO detected`);
    return 'negative';
  }
  
  // Check casual/slang responses
  if (casualYes.test(lowerText)) {
    console.log(`😎 Casual YES detected`);
    return 'positive';
  }
  
  if (casualNo.test(lowerText)) {
    console.log(`😒 Casual NO detected`);
    return 'negative';
  }
  
  // Check multilingual responses
  if (multilingualYes.test(lowerText)) {
    console.log(`🌍 Multilingual YES detected`);
    return 'positive';
  }
  
  if (multilingualNo.test(lowerText)) {
    console.log(`🌍 Multilingual NO detected`);
    return 'negative';
  }
  
  // Check polite responses
  if (politeYes.test(lowerText)) {
    console.log(`🎩 Polite YES detected`);
    return 'positive';
  }
  
  if (politeNo.test(lowerText)) {
    console.log(`🎩 Polite NO detected`);
    return 'negative';
  }
  
  // Check reluctant responses
  if (reluctant.test(lowerText)) {
    console.log(`😕 Reluctant response detected`);
    return 'neutral'; // Reluctant is treated as neutral/uncertain
  }
  
  // Check conditional/uncertain responses
  if (conditional.test(lowerText)) {
    console.log(`🤔 Conditional/Uncertain response detected`);
    return 'neutral';
  }
  
  // Check emoji patterns
  if (positiveEmojis.test(text)) {
    console.log(`😊 Positive emoji detected`);
    return 'positive';
  }
  
  if (negativeEmojis.test(text)) {
    console.log(`😞 Negative emoji detected`);
    return 'negative';
  }
  
  if (neutralEmojis.test(text)) {
    console.log(`🤔 Neutral emoji detected`);
    return 'neutral';
  }
  
  // Special edge cases
  
  // Single character responses
  if (/^y$/i.test(lowerText.trim())) {
    console.log(`📝 Single 'Y' detected as YES`);
    return 'positive';
  }
  
  if (/^n$/i.test(lowerText.trim())) {
    console.log(`📝 Single 'N' detected as NO`);
    return 'negative';
  }
  
  // Repeated characters (enthusiasm or emphasis)
  if (/y+e+s+/i.test(lowerText) && lowerText.length > 3) {
    console.log(`🎊 Enthusiastic YES (repeated chars) detected`);
    return 'positive';
  }
  
  if (/n+o+/i.test(lowerText) && lowerText.length > 2) {
    console.log(`🚫 Emphatic NO (repeated chars) detected`);
    return 'negative';
  }
  
  // Numbers as responses
  if (/\b(1|one)\b/i.test(lowerText)) {
    console.log(`🔢 Number '1' detected as YES`);
    return 'positive';
  }
  
  if (/\b(0|zero)\b/i.test(lowerText)) {
    console.log(`🔢 Number '0' detected as NO`);
    return 'negative';
  }
  
  console.log(`❓ No clear yes/no pattern detected, returning neutral`);
  return 'neutral';
}

// Comprehensive Keyword Detection System
class ComprehensiveKeywordDetector {
  
  // Greeting and Farewell Detection
  static detectGreeting(text) {
    const lowerText = text.toLowerCase().trim();
    
    const greetingPatterns = [
      // Basic greetings
      /\b(hello|hi|hey|hiya|howdy|greetings|good morning|good afternoon|good evening|good day)\b/i,
      // Casual greetings
      /\b(sup|what's up|whats up|wassup|yo|hola|namaste|salaam|salam)\b/i,
      // Time-based greetings
      /\b(morning|afternoon|evening|night)\b/i,
      // Multilingual greetings
      /\b(bonjour|guten tag|buongiorno|buenos dias|konnichiwa|annyeonghaseyo)\b/i,
      // Emoji greetings
      /👋|🙋|😊|😄|🙂|👍/g
    ];
    
    for (const pattern of greetingPatterns) {
      if (pattern.test(lowerText)) {
        console.log(`👋 Greeting detected: ${pattern}`);
        return { detected: true, type: 'greeting', confidence: 0.9 };
      }
    }
    
    return { detected: false, type: null, confidence: 0 };
  }
  
  static detectFarewell(text) {
    const lowerText = text.toLowerCase().trim();
    
    const farewellPatterns = [
      // Basic farewells
      /\b(goodbye|bye|farewell|see you|talk to you later|ttyl|catch you later|take care)\b/i,
      // Casual farewells
      /\b(later|peace|ciao|adios|au revoir|auf wiedersehen|sayonara|cheers)\b/i,
      // Polite endings
      /\b(have a good day|have a great day|have a nice day|good night|sweet dreams)\b/i,
      // Emoji farewells
      /👋|😊|🙂|✌️|👍/g
    ];
    
    for (const pattern of farewellPatterns) {
      if (pattern.test(lowerText)) {
        console.log(`👋 Farewell detected: ${pattern}`);
        return { detected: true, type: 'farewell', confidence: 0.9 };
      }
    }
    
    return { detected: false, type: null, confidence: 0 };
  }
  
  // Urgency Detection
  static detectUrgency(text) {
    const lowerText = text.toLowerCase().trim();
    
    const urgencyPatterns = [
      // High urgency
      /\b(urgent|emergency|asap|as soon as possible|immediately|right now|right away|critical|important)\b/i,
      // Time pressure
      /\b(quickly|fast|hurry|rush|deadline|time sensitive|time-sensitive|pressing)\b/i,
      // Priority indicators
      /\b(priority|high priority|top priority|crucial|vital|essential|must)\b/i,
      // Emotional urgency
      /\b(please hurry|need help|help me|desperate|can't wait)\b/i,
      // Punctuation indicators
      /!{2,}|URGENT|EMERGENCY|ASAP/g
    ];
    
    let urgencyLevel = 'none';
    let confidence = 0;
    
    for (const pattern of urgencyPatterns) {
      if (pattern.test(lowerText)) {
        if (pattern.source.includes('emergency|urgent|asap|immediately')) {
          urgencyLevel = 'high';
          confidence = 0.95;
        } else if (pattern.source.includes('quickly|priority|important')) {
          urgencyLevel = 'medium';
          confidence = 0.8;
        } else {
          urgencyLevel = 'low';
          confidence = 0.6;
        }
        console.log(`🚨 Urgency detected: ${urgencyLevel} (${pattern})`);
        break;
      }
    }
    
    return { detected: urgencyLevel !== 'none', level: urgencyLevel, confidence };
  }
  
  // Politeness and Tone Detection
  static detectPoliteness(text) {
    const lowerText = text.toLowerCase().trim();
    
    const politenessPatterns = [
      // Polite requests
      /\b(please|kindly|would you|could you|may i|if you don't mind|if possible)\b/i,
      // Gratitude
      /\b(thank you|thanks|appreciate|grateful|much obliged|cheers)\b/i,
      // Apologies
      /\b(sorry|apologize|excuse me|pardon|my bad|forgive me)\b/i,
      // Formal politeness
      /\b(sir|madam|mr|mrs|ms|dear|respectfully|humbly)\b/i,
      // Consideration
      /\b(when convenient|at your convenience|no rush|take your time|whenever you can)\b/i
    ];
    
    let politenessLevel = 'neutral';
    let confidence = 0;
    
    for (const pattern of politenessPatterns) {
      if (pattern.test(lowerText)) {
        if (pattern.source.includes('please|thank|appreciate|sorry')) {
          politenessLevel = 'high';
          confidence = 0.9;
        } else if (pattern.source.includes('would you|could you|kindly')) {
          politenessLevel = 'medium';
          confidence = 0.7;
        } else {
          politenessLevel = 'low';
          confidence = 0.5;
        }
        console.log(`🎩 Politeness detected: ${politenessLevel} (${pattern})`);
        break;
      }
    }
    
    return { detected: politenessLevel !== 'neutral', level: politenessLevel, confidence };
  }
  
  // Cancellation and Rescheduling Detection
  static detectCancellationRescheduling(text) {
    const lowerText = text.toLowerCase().trim();
    
    const cancellationPatterns = [
      // Direct cancellation
      /\b(cancel|cancelled|canceling|abort|stop|halt|terminate|end|quit)\b/i,
      // Rescheduling
      /\b(reschedule|postpone|delay|move|shift|change|different time|another time)\b/i,
      // Availability changes
      /\b(not available|can't make it|won't be able|something came up|conflict|busy)\b/i,
      // Polite cancellation
      /\b(need to cancel|have to cancel|sorry but|unfortunately|regret to inform)\b/i
    ];
    
    let actionType = 'none';
    let confidence = 0;
    
    for (const pattern of cancellationPatterns) {
      if (pattern.test(lowerText)) {
        if (pattern.source.includes('reschedule|postpone|move|shift|change|different time')) {
          actionType = 'reschedule';
          confidence = 0.9;
        } else if (pattern.source.includes('cancel|abort|stop|quit')) {
          actionType = 'cancel';
          confidence = 0.95;
        } else {
          actionType = 'unavailable';
          confidence = 0.8;
        }
        console.log(`📅 Cancellation/Rescheduling detected: ${actionType} (${pattern})`);
        break;
      }
    }
    
    return { detected: actionType !== 'none', action: actionType, confidence };
  }
  
  // Confusion and Clarification Detection
  static detectConfusion(text) {
    const lowerText = text.toLowerCase().trim();
    
    const confusionPatterns = [
      // Direct confusion
      /\b(confused|don't understand|unclear|what do you mean|what|huh|eh)\b/i,
      // Questions for clarification
      /\b(can you explain|could you clarify|what exactly|how do you mean|i'm lost)\b/i,
      // Uncertainty expressions
      /\b(not sure|uncertain|don't know|no idea|clueless|puzzled|baffled)\b/i,
      // Request for help
      /\b(help me understand|need clarification|can you help|explain please)\b/i,
      // Emotional confusion
      /\b(frustrated|lost|overwhelmed|don't get it|makes no sense)\b/i,
      // Question marks and confusion emojis
      /\?{2,}|😕|😵|🤔|❓|❔/g
    ];
    
    let confusionLevel = 'none';
    let confidence = 0;
    
    for (const pattern of confusionPatterns) {
      if (pattern.test(lowerText)) {
        if (pattern.source.includes('confused|don\'t understand|unclear|what')) {
          confusionLevel = 'high';
          confidence = 0.9;
        } else if (pattern.source.includes('not sure|uncertain|help')) {
          confusionLevel = 'medium';
          confidence = 0.7;
        } else {
          confusionLevel = 'low';
          confidence = 0.5;
        }
        console.log(`🤔 Confusion detected: ${confusionLevel} (${pattern})`);
        break;
      }
    }
    
    return { detected: confusionLevel !== 'none', level: confusionLevel, confidence };
  }
  
  // Reason/Purpose Detection for Call Scheduling
  static detectCallReason(text) {
    const lowerText = text.toLowerCase().trim();
    
    const reasonPatterns = [
      // Business reasons
      /\b(business|work|professional|meeting|consultation|discussion|proposal)\b/i,
      // Educational reasons
      /\b(education|learning|course|training|study|academic|school|university)\b/i,
      // Support reasons
      /\b(support|help|assistance|guidance|advice|question|problem|issue)\b/i,
      // Sales/Marketing reasons
      /\b(sales|marketing|product|service|demo|presentation|offer|deal)\b/i,
      // Personal reasons
      /\b(personal|private|family|health|medical|urgent|important)\b/i,
      // Information seeking
      /\b(information|details|inquiry|question|clarification|explanation)\b/i,
      // Follow-up reasons
      /\b(follow up|follow-up|callback|return call|continuation|update)\b/i
    ];
    
    const detectedReasons = [];
    let confidence = 0;
    
    for (const pattern of reasonPatterns) {
      if (pattern.test(lowerText)) {
        let reasonType = 'general';
        if (pattern.source.includes('business|work|professional')) reasonType = 'business';
        else if (pattern.source.includes('education|learning|course')) reasonType = 'educational';
        else if (pattern.source.includes('support|help|assistance')) reasonType = 'support';
        else if (pattern.source.includes('sales|marketing|product')) reasonType = 'sales';
        else if (pattern.source.includes('personal|private|family')) reasonType = 'personal';
        else if (pattern.source.includes('information|details|inquiry')) reasonType = 'information';
        else if (pattern.source.includes('follow')) reasonType = 'followup';
        
        detectedReasons.push(reasonType);
        confidence = Math.max(confidence, 0.8);
        console.log(`📋 Call reason detected: ${reasonType} (${pattern})`);
      }
    }
    
    return { 
      detected: detectedReasons.length > 0, 
      reasons: detectedReasons, 
      primary: detectedReasons[0] || 'general',
      confidence 
    };
  }
  
  // Comprehensive Analysis Function
  static analyzeMessage(text) {
    const analysis = {
      greeting: this.detectGreeting(text),
      farewell: this.detectFarewell(text),
      urgency: this.detectUrgency(text),
      politeness: this.detectPoliteness(text),
      cancellation: this.detectCancellationRescheduling(text),
      confusion: this.detectConfusion(text),
      callReason: this.detectCallReason(text),
      timestamp: new Date().toISOString()
    };
    
    // Calculate overall message characteristics
    analysis.overall = {
      isGreeting: analysis.greeting.detected,
      isFarewell: analysis.farewell.detected,
      isUrgent: analysis.urgency.detected && analysis.urgency.level !== 'none',
      isPolite: analysis.politeness.detected && analysis.politeness.level !== 'neutral',
      needsCancellation: analysis.cancellation.detected,
      needsHelp: analysis.confusion.detected,
      hasReason: analysis.callReason.detected,
      tone: this.determineTone(analysis)
    };
    
    console.log(`🔍 Message Analysis Complete:`, JSON.stringify(analysis.overall, null, 2));
    return analysis;
  }
  
  // Determine overall message tone
  static determineTone(analysis) {
    if (analysis.urgency.detected && analysis.urgency.level === 'high') return 'urgent';
    if (analysis.confusion.detected && analysis.confusion.level === 'high') return 'confused';
    if (analysis.cancellation.detected) return 'cancelling';
    if (analysis.politeness.detected && analysis.politeness.level === 'high') return 'polite';
    if (analysis.greeting.detected) return 'friendly';
    if (analysis.farewell.detected) return 'closing';
    return 'neutral';
  }
}

// Enhanced sentiment analysis with comprehensive keyword support
function analyzeComprehensiveSentiment(text, context = 'general') {
  // First run the comprehensive keyword analysis
  const keywordAnalysis = ComprehensiveKeywordDetector.analyzeMessage(text);
  
  // Then run the existing sentiment analysis
  const basicSentiment = analyzeKeywordSentiment(text, context);
  
  // Combine results for more accurate sentiment
  let finalSentiment = basicSentiment;
  
  // Adjust sentiment based on keyword analysis
  if (keywordAnalysis.urgency.detected && keywordAnalysis.urgency.level === 'high') {
    finalSentiment = 'urgent_positive'; // Special case for urgent requests
  } else if (keywordAnalysis.confusion.detected && keywordAnalysis.confusion.level === 'high') {
    finalSentiment = 'confused_neutral';
  } else if (keywordAnalysis.cancellation.detected) {
    finalSentiment = keywordAnalysis.cancellation.action === 'cancel' ? 'negative' : 'neutral';
  } else if (keywordAnalysis.politeness.detected && keywordAnalysis.politeness.level === 'high') {
    // Polite messages tend to be more positive
    if (finalSentiment === 'neutral') finalSentiment = 'positive';
  }
  
  console.log(`🎯 Comprehensive Sentiment: ${finalSentiment} (base: ${basicSentiment})`);
  
  return {
    sentiment: finalSentiment,
    keywords: keywordAnalysis,
    confidence: Math.max(
      keywordAnalysis.urgency.confidence,
      keywordAnalysis.politeness.confidence,
      keywordAnalysis.confusion.confidence,
      keywordAnalysis.cancellation.confidence
    )
  };
}



// Parse time expressions using TinyLlama AI model with interactive prompting
async function parseTimeExpression(text, currentDateTime = new Date()) {
  console.log(`🕐 Parsing time expression: "${text}"`);
  
  // Check for immediate "now" keywords first
  const lowerText = text.toLowerCase();
  const immediateKeywords = [
    // Core "now" expressions
    /\b(now|right now|just now|at this moment|this instant|this second|this minute)\b/i,
    // Urgency expressions
    /\b(asap|a\.s\.a\.p\.|as soon as possible|immediately|instantly|urgently|straight away|right away|at once)\b/i,
    // Casual immediate expressions
    /\b(pronto|stat|quick|quickly|fast|rapid|swift|prompt|without delay|no delay)\b/i,
    // Current time references
    /\b(current time|present time|this time|at this time|the time now|time right now)\b/i,
    // Very short delays
    /\b(in a sec|in a second|in seconds|in a moment|in just a moment|in a jiffy|in a flash|in no time)\b/i,
    // Colloquial expressions
    /\b(rn|rt now|rite now|nao|naow|rightnow|asap pls|asap please|call me now|call now|ring now|phone now)\b/i,
    // International variations
    /\b(maintenant|ahora|jetzt|ora|agora|sekarang|지금|今|сейчас|الآن)\b/i,
    // Slang and informal
    /\b(rn pls|asap af|like now|literally now|actually now|seriously now|for real now|no joke now)\b/i,
    // Time-sensitive expressions
    /\b(before it's too late|time sensitive|urgent call|emergency call|critical call|important call now)\b/i
  ];
  
  // Check if text contains any immediate keywords
  const isImmediate = immediateKeywords.some(pattern => pattern.test(lowerText));
  
  if (isImmediate) {
    const currentMoment = moment(currentDateTime);
    const currentDate = currentMoment.format('DD/MM/YYYY');
    const currentTime = currentMoment.format('HH:mm');
    const formatted = `${currentDate}::${currentTime}`;
    
    console.log(`⚡ Immediate "now" keyword detected - scheduling for current time: ${formatted}`);
    return {
      success: true,
      date: currentDate,
      time: currentTime,
      hasDate: true,
      hasTime: true,
      formatted: formatted,
      complete: true,
      immediate: true // Flag to indicate this was an immediate request
    };
  }
  
  // Use TinyLlama for intelligent parsing
  const result = await parseTimeWithTinyLlama(text, currentDateTime);
  
  if (result.success) {
    // Check if we have both date and time
    if (result.hasDate && result.hasTime) {
      console.log(`✅ Complete time parsed: ${result.formatted}`);
      return {
        success: true,
        date: result.date,
        time: result.time,
        hasDate: result.hasDate,
        hasTime: result.hasTime,
        formatted: result.formatted,
        complete: true
      };
    }
    
    // Return partial result for interactive prompting
    console.log(`⏳ Partial time parsed - Date: ${result.hasDate ? result.date : 'MISSING'}, Time: ${result.hasTime ? result.time : 'MISSING'}`);
    return {
      success: true,
      date: result.date,
      time: result.time,
      hasDate: result.hasDate,
      hasTime: result.hasTime,
      needsDate: result.needsDate,
      needsTime: result.needsTime,
      complete: false,
      partial: true
    };
  } else {
    console.log(`⚠️ Time parsing failed, using default`);
    return {
      success: false,
      date: moment(currentDateTime).format('DD/MM/YYYY'),
      time: '14:00',
      formatted: moment(currentDateTime).format('DD/MM/YYYY') + '::14:00',
      complete: false
    };
  }
}

// Enhanced date/time parsing with better natural language support
async function parseTimeWithTinyLlama(text, currentDateTime = new Date()) {
  try {
    const now = moment(currentDateTime);
    const lowerText = text.toLowerCase().trim();
    
    let parsedDate = null;
    let parsedTime = null;
    let hasDate = false;
    let hasTime = false;

    // Enhanced date parsing patterns
    const datePatterns = [
      // Relative dates
      { pattern: /\b(yesterday|yest)\b/, handler: () => now.subtract(1, 'day').format('DD/MM/YYYY') },
      { pattern: /\b(today|tod)\b/, handler: () => now.format('DD/MM/YYYY') },
      { pattern: /\b(tomorrow|tmrw|tom)\b/, handler: () => now.add(1, 'day').format('DD/MM/YYYY') },
      { pattern: /\b(day after tomorrow|overmorrow)\b/, handler: () => now.add(2, 'days').format('DD/MM/YYYY') },
      
      // Day names
      { pattern: /\b(monday|mon)\b/, handler: () => getNextWeekday(now, 1) },
      { pattern: /\b(tuesday|tue|tues)\b/, handler: () => getNextWeekday(now, 2) },
      { pattern: /\b(wednesday|wed)\b/, handler: () => getNextWeekday(now, 3) },
      { pattern: /\b(thursday|thu|thurs)\b/, handler: () => getNextWeekday(now, 4) },
      { pattern: /\b(friday|fri)\b/, handler: () => getNextWeekday(now, 5) },
      { pattern: /\b(saturday|sat)\b/, handler: () => getNextWeekday(now, 6) },
      { pattern: /\b(sunday|sun)\b/, handler: () => getNextWeekday(now, 0) },
      
      // Specific dates
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*(jan|january)\b/, handler: (match) => formatDate(match[1], 1, now.year()) },
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*(feb|february)\b/, handler: (match) => formatDate(match[1], 2, now.year()) },
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*(mar|march)\b/, handler: (match) => formatDate(match[1], 3, now.year()) },
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*(apr|april)\b/, handler: (match) => formatDate(match[1], 4, now.year()) },
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*(may)\b/, handler: (match) => formatDate(match[1], 5, now.year()) },
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*(jun|june)\b/, handler: (match) => formatDate(match[1], 6, now.year()) },
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*(jul|july)\b/, handler: (match) => formatDate(match[1], 7, now.year()) },
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*(aug|august)\b/, handler: (match) => formatDate(match[1], 8, now.year()) },
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*(sep|september)\b/, handler: (match) => formatDate(match[1], 9, now.year()) },
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*(oct|october)\b/, handler: (match) => formatDate(match[1], 10, now.year()) },
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*(nov|november)\b/, handler: (match) => formatDate(match[1], 11, now.year()) },
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\s*(dec|december)\b/, handler: (match) => formatDate(match[1], 12, now.year()) },
      
      // Numeric dates
      { pattern: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/, handler: (match) => {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3].length === 2 ? '20' + match[3] : match[3];
        return `${day}/${month}/${year}`;
      }},
      { pattern: /\b(\d{1,2})(st|nd|rd|th)?\b/, handler: (match) => {
        const day = parseInt(match[1]);
        if (day >= 1 && day <= 31) {
          return formatDate(day, now.month() + 1, now.year());
        }
        return null;
      }}
    ];

    // Enhanced time parsing patterns
    const timePatterns = [
      // 12-hour format
      { pattern: /\b(\d{1,2}):(\d{2})\s*(am|pm)\b/, handler: (match) => {
        let hour = parseInt(match[1]);
        const minute = match[2];
        const ampm = match[3].toLowerCase();
        if (ampm === 'pm' && hour !== 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:${minute}`;
      }},
      { pattern: /\b(\d{1,2})\s*(am|pm)\b/, handler: (match) => {
        let hour = parseInt(match[1]);
        const ampm = match[2].toLowerCase();
        if (ampm === 'pm' && hour !== 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:00`;
      }},
      
      // 24-hour format
      { pattern: /\b(\d{1,2}):(\d{2})\b/, handler: (match) => {
        const hour = parseInt(match[1]);
        const minute = match[2];
        if (hour >= 0 && hour <= 23) {
          return `${hour.toString().padStart(2, '0')}:${minute}`;
        }
        return null;
      }},
      
      // Named times
      { pattern: /\b(morning|morn)\b/, handler: () => '09:00' },
      { pattern: /\b(afternoon|noon)\b/, handler: () => '14:00' },
      { pattern: /\b(evening|eve)\b/, handler: () => '18:00' },
      { pattern: /\b(night|nite)\b/, handler: () => '20:00' },
      { pattern: /\b(midnight)\b/, handler: () => '00:00' },
      { pattern: /\b(lunch|lunchtime)\b/, handler: () => '12:30' },
      { pattern: /\b(dinner|dinnertime)\b/, handler: () => '19:00' },
      { pattern: /\b(breakfast)\b/, handler: () => '08:00' },
      
      // === COMPREHENSIVE IMMEDIATE TIME LIBRARY ===
      
      // Core "now" expressions
      { pattern: /\b(now|right now|just now|at this moment|this instant|this second|this minute)\b/i, handler: () => {
        return moment(currentDateTime).format('HH:mm');
      }},
      
      // Urgency expressions
      { pattern: /\b(asap|a\.s\.a\.p\.|as soon as possible|immediately|instantly|urgently|straight away|right away|at once)\b/i, handler: () => {
        return moment(currentDateTime).format('HH:mm');
      }},
      
      // Casual immediate expressions
      { pattern: /\b(pronto|stat|quick|quickly|fast|rapid|swift|prompt|without delay|no delay)\b/i, handler: () => {
        return moment(currentDateTime).format('HH:mm');
      }},
      
      // Current time references
      { pattern: /\b(current time|present time|this time|at this time|the time now|time right now)\b/i, handler: () => {
        return moment(currentDateTime).format('HH:mm');
      }},
      
      // Very short delays (1-2 minutes)
      { pattern: /\b(in a sec|in a second|in seconds|in a moment|in just a moment|in a jiffy|in a flash|in no time)\b/i, handler: () => {
        return moment(currentDateTime).add(1, 'minute').format('HH:mm');
      }},
      
      // Short delays (3-5 minutes)
      { pattern: /\b(in a few minutes|in a minute|in 2 minutes|in two minutes|in 3 minutes|in three minutes|in 4 minutes|in four minutes|in 5 minutes|in five minutes|shortly|very soon|real soon|soon)\b/i, handler: () => {
        return moment(currentDateTime).add(5, 'minutes').format('HH:mm');
      }},
      
      // Medium short delays (10 minutes)
      { pattern: /\b(in 10 minutes|in ten minutes|in 6 minutes|in six minutes|in 7 minutes|in seven minutes|in 8 minutes|in eight minutes|in 9 minutes|in nine minutes)\b/i, handler: () => {
        return moment(currentDateTime).add(10, 'minutes').format('HH:mm');
      }},
      
      // Quarter hour delays (15 minutes)
      { pattern: /\b(in 15 minutes|in fifteen minutes|in a quarter hour|in quarter of an hour|in 11 minutes|in eleven minutes|in 12 minutes|in twelve minutes|in 13 minutes|in thirteen minutes|in 14 minutes|in fourteen minutes)\b/i, handler: () => {
        return moment(currentDateTime).add(15, 'minutes').format('HH:mm');
      }},
      
      // Twenty minute delays
      { pattern: /\b(in 20 minutes|in twenty minutes|in 16 minutes|in sixteen minutes|in 17 minutes|in seventeen minutes|in 18 minutes|in eighteen minutes|in 19 minutes|in nineteen minutes)\b/i, handler: () => {
        return moment(currentDateTime).add(20, 'minutes').format('HH:mm');
      }},
      
      // Half hour delays (30 minutes)
      { pattern: /\b(in 30 minutes|in thirty minutes|in half an hour|in a half hour|in 25 minutes|in twenty five minutes|in 26 minutes|in twenty six minutes|in 27 minutes|in twenty seven minutes|in 28 minutes|in twenty eight minutes|in 29 minutes|in twenty nine minutes)\b/i, handler: () => {
        return moment(currentDateTime).add(30, 'minutes').format('HH:mm');
      }},
      
      // Forty-five minute delays
      { pattern: /\b(in 45 minutes|in forty five minutes|in three quarters of an hour|in 40 minutes|in forty minutes|in 41 minutes|in forty one minutes|in 42 minutes|in forty two minutes|in 43 minutes|in forty three minutes|in 44 minutes|in forty four minutes)\b/i, handler: () => {
        return moment(currentDateTime).add(45, 'minutes').format('HH:mm');
      }},
      
      // One hour delays
      { pattern: /\b(in an hour|in 1 hour|in one hour|in 60 minutes|in sixty minutes|in 50 minutes|in fifty minutes|in 55 minutes|in fifty five minutes)\b/i, handler: () => {
        return moment(currentDateTime).add(1, 'hour').format('HH:mm');
      }},
      
      // Hour and a half delays
      { pattern: /\b(in an hour and a half|in 1\.5 hours|in one and a half hours|in 90 minutes|in ninety minutes)\b/i, handler: () => {
        return moment(currentDateTime).add(90, 'minutes').format('HH:mm');
      }},
      
      // Two hour delays
      { pattern: /\b(in 2 hours|in two hours|in a couple hours|in a couple of hours|in 120 minutes|in one hundred twenty minutes)\b/i, handler: () => {
        return moment(currentDateTime).add(2, 'hours').format('HH:mm');
      }},
      
      // Informal time expressions
      { pattern: /\b(whenever|anytime|any time|when you can|when possible|when convenient|at your convenience)\b/i, handler: () => {
        return moment(currentDateTime).add(30, 'minutes').format('HH:mm');
      }},
      
      // Business context expressions
      { pattern: /\b(during business hours|in office hours|during work hours|during working hours)\b/i, handler: () => {
        const currentMoment = moment(currentDateTime);
        const hour = currentMoment.hour();
        if (hour < 9) {
          return currentMoment.hour(9).minute(0).format('HH:mm');
        } else if (hour >= 17) {
          return currentMoment.add(1, 'day').hour(9).minute(0).format('HH:mm');
        } else {
          return currentMoment.format('HH:mm');
        }
      }},
      
      // Colloquial expressions
      { pattern: /\b(rn|rt now|rite now|nao|naow|rightnow|asap pls|asap please|call me now|call now|ring now|phone now)\b/i, handler: () => {
        return moment(currentDateTime).format('HH:mm');
      }},
      
      // International variations
      { pattern: /\b(maintenant|ahora|jetzt|ora|agora|sekarang|지금|今|сейчас|الآن)\b/i, handler: () => {
        return moment(currentDateTime).format('HH:mm');
      }},
      
      // Slang and informal
      { pattern: /\b(rn pls|asap af|like now|literally now|actually now|seriously now|for real now|no joke now)\b/i, handler: () => {
        return moment(currentDateTime).format('HH:mm');
      }},
      
      // Time-sensitive expressions
      { pattern: /\b(before it's too late|time sensitive|urgent call|emergency call|critical call|important call now)\b/i, handler: () => {
        return moment(currentDateTime).format('HH:mm');
      }},
      
      // Contextual expressions
      { pattern: /\b(while I'm free|while I have time|before I forget|before I get busy|while I remember)\b/i, handler: () => {
        return moment(currentDateTime).add(5, 'minutes').format('HH:mm');
      }}
    ];

    // Parse date
    for (const datePattern of datePatterns) {
      const match = lowerText.match(datePattern.pattern);
      if (match) {
        const result = datePattern.handler(match);
        if (result) {
          parsedDate = result;
          hasDate = true;
          break;
        }
      }
    }

    // Parse time
    for (const timePattern of timePatterns) {
      const match = lowerText.match(timePattern.pattern);
      if (match) {
        const result = timePattern.handler(match);
        if (result) {
          parsedTime = result;
          hasTime = true;
          break;
        }
      }
    }

    console.log(`🔍 Enhanced parsing: "${text}" -> Date: ${parsedDate} (has: ${hasDate}), Time: ${parsedTime} (has: ${hasTime})`);

    return {
      success: true,
      date: parsedDate,
      time: parsedTime,
      hasDate: hasDate,
      hasTime: hasTime,
      needsDate: !hasDate,
      needsTime: !hasTime,
      partial: hasDate !== hasTime, // true if only one is found
      formatted: hasDate && hasTime ? `${parsedDate}::${parsedTime}` : null
    };

  } catch (error) {
    console.error('❌ Error in enhanced time parsing:', error);
    return parseTimeSimple(text, currentDateTime);
  }
}

// Helper functions
function getNextWeekday(now, targetDay) {
  const currentDay = now.day();
  let daysToAdd = targetDay - currentDay;
  if (daysToAdd <= 0) daysToAdd += 7; // Next occurrence
  return now.clone().add(daysToAdd, 'days').format('DD/MM/YYYY');
}

function formatDate(day, month, year) {
  return botUtils.formatDate(day, month, year);
}

// Validation function to check if date/time is in the past
function isDateTimeInPast(date, time, currentDateTime = new Date(), originalText = '') {
  try {
    // Special handling for "now" and immediate time keywords
    const immediateKeywords = /\b(now|right now|immediately|asap|as soon as possible|straight away|right away|this instant|this moment|at once|instantly)\b/i;
    if (immediateKeywords.test(originalText)) {
      // Allow "now" and immediate keywords even if they might be technically in the past by a few seconds
      return false;
    }
    
    const now = moment(currentDateTime);
    const targetDateTime = moment(`${date} ${time}`, 'DD/MM/YYYY HH:mm');
    
    // Allow a small buffer (1 minute) for "now" times to account for processing delays
    const bufferTime = moment(currentDateTime).subtract(1, 'minute');
    
    return targetDateTime.isBefore(bufferTime);
  } catch (error) {
    console.error('Error checking if date/time is in past:', error);
    return false; // Default to allowing the time if there's an error
  }
}

// Helper function to handle past date/time validation and user redirection
async function handlePastDateTimeValidation(message, date, time, currentDateTime, originalText) {
  if (isDateTimeInPast(date, time, currentDateTime, originalText)) {
    const targetDateTime = moment(`${date} ${time}`, 'DD/MM/YYYY HH:mm');
    const formattedDateTime = targetDateTime.format('dddd, MMMM Do [at] h:mm A');
    
    await message.reply(config.getMessage('messages.errors.pastDateTime').replace('{datetime}', formattedDateTime));
    
    // Reset user to post-greeting stage (asking for call time)
    createOrUpdateSession(message.from, {
      state: CONVERSATION_STATES.ASKING_CALL_TIME,
      currentQuestion: 'call_time',
      pendingSchedule: null,
      partialSchedule: null,
      pastDateAttempt: {
        attemptedDateTime: formattedDateTime,
        originalText: originalText,
        timestamp: new Date().toISOString()
      }
    });
    
    return true; // Indicates past date was detected and handled
  }
  return false; // No past date detected
}

// Simple time parsing fallback
function parseTimeSimple(text, currentDateTime = new Date()) {
  const lowerText = text.toLowerCase().trim();
  const now = moment(currentDateTime);
  
  let targetDate = null;
  let targetTime = null;
  
  // Date parsing
  if (lowerText.includes('tomorrow')) {
    targetDate = now.clone().add(1, 'day');
  } else if (lowerText.includes('day after tomorrow')) {
    targetDate = now.clone().add(2, 'days');
  } else if (lowerText.includes('next week')) {
    targetDate = now.clone().add(1, 'week');
  } else if (lowerText.includes('monday')) {
    targetDate = now.clone().day(1);
    if (targetDate.isSameOrBefore(now)) {
      targetDate.add(1, 'week');
    }
  } else if (lowerText.includes('tuesday')) {
    targetDate = now.clone().day(2);
    if (targetDate.isSameOrBefore(now)) {
      targetDate.add(1, 'week');
    }
  } else if (lowerText.includes('wednesday')) {
    targetDate = now.clone().day(3);
    if (targetDate.isSameOrBefore(now)) {
      targetDate.add(1, 'week');
    }
  } else if (lowerText.includes('thursday')) {
    targetDate = now.clone().day(4);
    if (targetDate.isSameOrBefore(now)) {
      targetDate.add(1, 'week');
    }
  } else if (lowerText.includes('friday')) {
    targetDate = now.clone().day(5);
    if (targetDate.isSameOrBefore(now)) {
      targetDate.add(1, 'week');
    }
  } else if (lowerText.includes('saturday')) {
    targetDate = now.clone().day(6);
    if (targetDate.isSameOrBefore(now)) {
      targetDate.add(1, 'week');
    }
  } else if (lowerText.includes('sunday')) {
    targetDate = now.clone().day(0);
    if (targetDate.isSameOrBefore(now)) {
      targetDate.add(1, 'week');
    }
  } else {
    targetDate = now.clone(); // Default to today
  }
  
  // Time parsing
  if (lowerText.includes('morning')) {
    targetTime = '09:00';
  } else if (lowerText.includes('afternoon')) {
    targetTime = '14:00';
  } else if (lowerText.includes('evening')) {
    targetTime = '18:00';
  } else if (lowerText.includes('night')) {
    targetTime = '20:00';
  } else {
    // Try to extract specific time
    const timeMatch = lowerText.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3];
      
      if (ampm === 'pm' && hour !== 12) {
        hour += 12;
      } else if (ampm === 'am' && hour === 12) {
        hour = 0;
      }
      
      targetTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    } else {
      targetTime = '09:00'; // Default time
    }
  }
  
  const formattedDate = targetDate.format('DD/MM/YYYY');
  
  return {
    success: true,
    date: formattedDate,
    time: targetTime,
    formatted: `${formattedDate}::${targetTime}`,
    hasDate: true,
    hasTime: true
  };
}

// Function to save call schedule
function saveCallSchedule(phoneNumber, scheduleData) {
  let allSchedules = {};
  
  // Read existing schedules
  if (fs.existsSync(CALL_SCHEDULE_FILE)) {
    try {
      const fileContent = fs.readFileSync(CALL_SCHEDULE_FILE, 'utf8');
      allSchedules = JSON.parse(fileContent);
    } catch (error) {
      console.error('Error reading call schedule file:', error);
      allSchedules = {};
    }
  }
  
  // Add new schedule
  allSchedules[phoneNumber] = {
    ...scheduleData,
    createdAt: new Date().toISOString(),
    status: 'scheduled'
  };
  
  // Write back to file
  try {
    fs.writeFileSync(CALL_SCHEDULE_FILE, JSON.stringify(allSchedules, null, 2));
    console.log(`Call scheduled for ${phoneNumber}: ${scheduleData.date} at ${scheduleData.time}`);
  } catch (error) {
    console.error('Error saving call schedule:', error);
  }
}

// Function to check for time conflicts with existing bookings
function checkTimeConflict(newDate, newTime, excludePhoneNumber = null) {
  try {
    // Read existing schedules
    if (!fs.existsSync(CALL_SCHEDULE_FILE)) {
      return { hasConflict: false }; // No existing schedules
    }
    
    const fileContent = fs.readFileSync(CALL_SCHEDULE_FILE, 'utf8');
    const allSchedules = JSON.parse(fileContent);
    
    // Parse the new appointment time
    const newDateTime = moment(`${newDate} ${newTime}`, 'DD/MM/YYYY HH:mm');
    
    if (!newDateTime.isValid()) {
      console.error('Invalid date/time format for conflict check:', newDate, newTime);
      return { hasConflict: false };
    }
    
    // Check against all existing appointments
    for (const [phoneNumber, schedule] of Object.entries(allSchedules)) {
      // Skip if this is the same phone number (for rescheduling scenarios)
      if (excludePhoneNumber && phoneNumber === excludePhoneNumber) {
        continue;
      }
      
      // Skip cancelled or completed appointments
      if (schedule.status && (schedule.status === 'cancelled' || schedule.status === 'completed')) {
        continue;
      }
      
      // Parse existing appointment time
      const existingDateTime = moment(`${schedule.date} ${schedule.time}`, 'DD/MM/YYYY HH:mm');
      
      if (!existingDateTime.isValid()) {
        console.warn('Invalid existing appointment time format:', schedule.date, schedule.time);
        continue;
      }
      
      // Calculate time difference in minutes
      const timeDifference = Math.abs(newDateTime.diff(existingDateTime, 'minutes'));
      
      // Check if appointments are within 15 minutes of each other
      if (timeDifference < 15) {
        const conflictDetails = {
          hasConflict: true,
          conflictingPhone: phoneNumber,
          conflictingDateTime: existingDateTime.format('dddd, MMMM Do [at] h:mm A'),
          conflictingDate: schedule.date,
          conflictingTime: schedule.time,
          timeDifference: timeDifference
        };
        
        console.log(`⚠️ Time conflict detected: New appointment (${newDateTime.format('DD/MM/YYYY HH:mm')}) conflicts with existing appointment for ${phoneNumber} (${existingDateTime.format('DD/MM/YYYY HH:mm')}) - ${timeDifference} minutes apart`);
        
        return conflictDetails;
      }
    }
    
    console.log(`✅ No time conflicts found for ${newDateTime.format('dddd, MMMM Do [at] h:mm A')}`);
    return { hasConflict: false };
    
  } catch (error) {
    console.error('Error checking time conflicts:', error);
    return { hasConflict: false }; // Default to no conflict on error
  }
}

// Smart Session Manager Class
class SmartSessionManager {
  constructor() {
    this.saveQueue = new Map();
    this.saveTimeout = null;
    this.debounceDelay = 2000; // 2 seconds debounce
    this.maxBatchSize = 10;
    this.lastSaveTime = null;
  }

  // Mark session for saving (debounced)
  markForSave(whatsappId, reason = 'activity') {
    this.saveQueue.set(whatsappId, {
      timestamp: new Date(),
      reason
    });

    // Debounce the save operation
    this.debounceSave();
  }

  // Debounced save operation
  debounceSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Immediate save for critical events
    if (this.isCriticalEvent()) {
      return this.executeSave();
    }

    // Dynamic delay based on queue size
    const dynamicDelay = this.calculateDynamicDelay();
    
    this.saveTimeout = setTimeout(() => {
      this.executeSave();
    }, dynamicDelay);
  }

  // Check if we have critical events that need immediate save
  isCriticalEvent() {
    for (const [_, info] of this.saveQueue) {
      if (info.reason === 'state_change' || info.reason === 'completion') {
        return true;
      }
    }
    return false;
  }

  // Calculate dynamic delay based on activity
  calculateDynamicDelay() {
    const queueSize = this.saveQueue.size;
    
    if (queueSize >= this.maxBatchSize) {
      return 500; // Save immediately if queue is large
    } else if (queueSize > 5) {
      return 1000; // 1 second for medium queue
    } else {
      return this.debounceDelay; // Default 2 seconds for small queue
    }
  }

  // Execute the actual save
  executeSave() {
    if (this.saveQueue.size === 0) {
      return;
    }

    const sessionsToSave = new Set(this.saveQueue.keys());

    try {
      this.saveSessionsToFile(Array.from(sessionsToSave));
      this.saveQueue.clear();
      this.lastSaveTime = new Date();
      
    } catch (error) {
      console.error('❌ Error saving sessions:', error);
    }
  }

  // Save specific sessions to file
  saveSessionsToFile(whatsappIds) {
    try {
      // Load existing sessions first
      let allSessions = {};
      if (fs.existsSync(SESSIONS_FILE)) {
        const existingData = fs.readFileSync(SESSIONS_FILE, 'utf8');
        allSessions = JSON.parse(existingData);
      }

      // Update only the sessions that need saving
      for (const whatsappId of whatsappIds) {
        const session = userSessions.get(whatsappId);
        if (session) {
          allSessions[whatsappId] = this.serializeSession(session);
        } else {
          // Session was deleted, remove from file
          delete allSessions[whatsappId];
        }
      }

      // Write back to file
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(allSessions, null, 2));
      
    } catch (error) {
      console.error('Error in saveSessionsToFile:', error);
      throw error;
    }
  }

  // Convert session to serializable format
  serializeSession(session) {
    return {
      state: session.state,
      currentQuestion: session.currentQuestion,
      data: session.data,
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      waitingForFreeText: session.waitingForFreeText || false,
      freeTextContext: session.freeTextContext || null,
      metadata: {
        saveCount: (session.metadata?.saveCount || 0) + 1,
        lastSaved: new Date().toISOString()
      }
    };
  }

  // Force immediate save (for shutdowns)
  forceSave() {
    console.log('🚨 Force saving all active sessions...');
    const allActiveSessions = Array.from(userSessions.keys());
    this.saveSessionsToFile(allActiveSessions);
  }
}

// Initialize the smart session manager
const sessionManager = new SmartSessionManager();

// Strict validation function - only accepts exact option letters


// Conversation states for simplified flow
const CONVERSATION_STATES = {
  IDLE: 'idle',
  GREETING: 'greeting',
  WAITING_INITIAL_RESPONSE: 'waiting_initial_response',
  ASKING_REASON: 'asking_reason',
  ASKING_CALL_TIME: 'asking_call_time',
  ASKING_DATE: 'asking_date',
  ASKING_TIME: 'asking_time',
  CONFIRMING_SCHEDULE: 'confirming_schedule',
  COMPLETED: 'completed',
  CLARIFYING_RESPONSE: 'clarifying_response'
};

// User session storage
const userSessions = new Map();

// Option mapping - convert letter options to full text descriptions






// Function to extract phone number from WhatsApp ID
function extractPhoneNumber(whatsappId) {
  return botUtils.extractPhoneNumber(whatsappId);
}

// Function to load target phone numbers from JSON file
async function loadTargetNumbers() {
  try {
    const data = await fs.promises.readFile(TARGET_NUMBERS_FILE, 'utf8');
    const config = JSON.parse(data);
    return config.targetPhoneNumbers || [];
  } catch (error) {
    console.error('Error loading target numbers from JSON file:', error.message);
    console.log('Using empty target numbers array as fallback');
    return [];
  }
}

// List of target phone numbers to automatically send welcome message to
let TARGET_PHONE_NUMBERS = [];

// Track which numbers have already received welcome messages to prevent duplicates
const welcomeSentNumbers = new Set();

// Function to check if a phone number is in the target list
function isTargetPhoneNumber(whatsappId) {
  const phoneNumber = extractPhoneNumber(whatsappId);
  return TARGET_PHONE_NUMBERS.includes(phoneNumber);
}



// Enhanced session creation and management
function createOrUpdateSession(whatsappId, updates = {}) {
  const now = new Date();
  const existingSession = userSessions.get(whatsappId);
  
  if (existingSession) {
    // Update existing session
    Object.assign(existingSession, updates, {
      lastActivity: now
    });
    
    // Mark for save with appropriate reason
    const saveReason = getSaveReason(updates);
    sessionManager.markForSave(whatsappId, saveReason);
    
    return existingSession;
  } else {
    // Create new session
    const newSession = {
      state: CONVERSATION_STATES.GREETING,
      currentQuestion: 'greeting_confirmation',
      data: {},
      createdAt: now,
      lastActivity: now,
      waitingForFreeText: false,
      freeTextContext: null,
      metadata: {
        saveCount: 0,
        messageCount: 0
      },
      ...updates
    };
    
    userSessions.set(whatsappId, newSession);
    sessionManager.markForSave(whatsappId, 'session_created');
    
    return newSession;
  }
}

// Determine save reason based on what changed
function getSaveReason(updates) {
  if (updates.state !== undefined) return 'state_change';
  if (updates.currentQuestion !== undefined) return 'question_change';
  if (updates.data !== undefined) return 'data_update';
  if (updates.waitingForFreeText !== undefined) return 'free_text_change';
  return 'activity';
}

// Function to automatically send welcome message to target users
async function sendAutoWelcomeMessage(whatsappId) {
  // ✅ STRONGER GUARD: Double-check with atomic operation
  if (welcomeSentNumbers.has(whatsappId)) {
    console.log(`🚫 BLOCKED: Skipping ${whatsappId} - welcome already sent`);
    return false;
  }
  
  if (userSessions.has(whatsappId)) {
    console.log(`🚫 BLOCKED: Skipping ${whatsappId} - active session exists`);
    return false;
  }

  try {
    const greeting = config.getMessage('messages.welcome.initial');

    console.log(`📤 SENDING welcome to ${whatsappId}`);
    
    // Mark as sent IMMEDIATELY to prevent any other calls
    welcomeSentNumbers.add(whatsappId);
    
    await client.sendMessage(whatsappId, greeting);

    // Create session
    createOrUpdateSession(whatsappId, {
      state: CONVERSATION_STATES.WAITING_INITIAL_RESPONSE,
      currentQuestion: 'initial_response'
    });

    console.log(`✅ SUCCESS: Auto welcome sent to ${whatsappId}`);
    return true;
  } catch (error) {
    // If sending failed, remove from sent numbers so it can be retried
    welcomeSentNumbers.delete(whatsappId);
    console.error(`❌ ERROR sending auto welcome to ${whatsappId}:`, error);
    return false;
  }
}

// Function to load sessions from file
async function loadSessionsFromFile() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) {
      console.log('No existing sessions file found');
      return;
    }
    
    const fileContent = fs.readFileSync(SESSIONS_FILE, 'utf8');
    const sessionsData = JSON.parse(fileContent);
    
    let loadedCount = 0;
    for (const [whatsappId, sessionData] of Object.entries(sessionsData)) {
      // Convert string dates back to Date objects
      userSessions.set(whatsappId, {
        ...sessionData,
        createdAt: new Date(sessionData.createdAt),
        lastActivity: new Date(sessionData.lastActivity),
        metadata: sessionData.metadata || { saveCount: 0, messageCount: 0 }
      });
      loadedCount++;
    }
    
    console.log(`🔄 Loaded ${loadedCount} sessions from file`);
    
    // Clean up expired sessions on load
    await cleanupExpiredSessions();
    
  } catch (error) {
    console.error('Error loading sessions from file:', error);
  }
}

// Enhanced session cleanup with file persistence and 7-day timeout
async function cleanupExpiredSessions() {
  const now = new Date();
  let cleanedCount = 0;
  const sessionTimeoutDays = config.getNumber('numbers.sessionTimeoutDays');
  const maxAge = sessionTimeoutDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
  
  for (const [whatsappId, session] of userSessions.entries()) {
    if (now - session.lastActivity > maxAge) {
      try {
        // Send session ended message before cleanup
        const sessionEndedMessage = config.getMessage('messages.timeout.sessionEnded');
        await client.sendMessage(whatsappId, sessionEndedMessage);
        console.log(`📤 Sent session timeout message to ${whatsappId}`);
      } catch (error) {
        console.error(`❌ Failed to send timeout message to ${whatsappId}:`, error.message);
      }
      
      userSessions.delete(whatsappId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned ${cleanedCount} expired sessions after ${sessionTimeoutDays} days of inactivity`);
    sessionManager.forceSave();
  }
}

// Function to restore welcome sent tracking (simplified)
function restoreWelcomeSentTracking() {
  // Welcome tracking is now handled through session data only
  console.log('📋 Welcome tracking restored from session data');
}

// Function to resume interrupted conversations (SILENT RESUME - no messages sent)
async function resumeInterruptedConversations() {
  let resumedCount = 0;
  
  for (const [whatsappId, session] of userSessions.entries()) {
    // Skip idle and completed sessions
    if (session.state === CONVERSATION_STATES.IDLE || 
        session.state === CONVERSATION_STATES.CLOSING) {
      continue;
    }
    
    try {
      // SILENT RESUME - Don't send any resume messages
      // Just update the last activity time and let the user continue naturally
      session.lastActivity = new Date();
      resumedCount++;
      
    } catch (error) {
      console.error(`Error resuming conversation for ${whatsappId}:`, error);
    }
  }
  
  console.log(`▶️ Silently resumed ${resumedCount} interrupted conversations`);
}

// Modified welcome function to only target new numbers
async function sendWelcomeToNewTargetNumbers() {
  let sentCount = 0;
  let skippedCount = 0;
  
  for (const phoneNumber of TARGET_PHONE_NUMBERS) {
    try {
      const whatsappId = `${phoneNumber}@c.us`;
      
      // Only send if no active session AND welcome not sent
      if (!userSessions.has(whatsappId) && !welcomeSentNumbers.has(whatsappId)) {
        await sendAutoWelcomeMessage(whatsappId);
        sentCount++;
        await delay(2000);
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.error(`Error sending welcome to ${phoneNumber}:`, error);
    }
  }
  
  console.log(`📊 WELCOME SUMMARY - New: ${sentCount}, Existing: ${skippedCount}`);
}

// Smart shutdown handler
function setupGracefulShutdown() {
  const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGUSR2'];
  
  shutdownSignals.forEach(signal => {
    process.on(signal, async () => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      // Force save all active sessions
      sessionManager.forceSave();
      
      // Add a small delay to ensure save completes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('✅ Shutdown complete');
      process.exit(0);
    });
  });
}

// Emergency save on uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.log('🚨 Attempting emergency save...');
  sessionManager.forceSave();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  console.log('🚨 Attempting emergency save...');
  sessionManager.forceSave();
});

// Helper function for delay
function delay(ms) {
  return botUtils.delay(ms);
}

// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, '..', 'auth_data')
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// QR code generation
client.on('qr', (qr) => {
  console.log('QR Code generated, scan it with your WhatsApp:');
  qrcode.generate(qr, { small: true });
});

// Client ready
client.on('ready', async () => {
  console.log('WhatsApp Bot is ready!');
  
  // Initialize AI models for sentiment analysis and time parsing
  await initializeAIModels();
  
  // Initialize smart session management
  setupGracefulShutdown();
  
  // Load persistent data FIRST
  await loadSessionsFromFile();
  restoreWelcomeSentTracking();
  
  // Then load target numbers
  TARGET_PHONE_NUMBERS = await loadTargetNumbers();
  console.log(`Loaded ${TARGET_PHONE_NUMBERS.length} target phone numbers from JSON file`);
  
  // SILENTLY resume conversations for active sessions (no messages sent)
  await resumeInterruptedConversations();
  
  // Then send welcome to new numbers
  await sendWelcomeToNewTargetNumbers();
  
  // Set up file watcher for target_numbers.json to dynamically reload numbers
  const watcher = chokidar.watch(TARGET_NUMBERS_FILE, {
    persistent: true,
    ignoreInitial: true
  });
  
  watcher.on('change', async (path) => {
    console.log('\n🔄 Target numbers file changed, reloading...');
    try {
      const newTargetNumbers = await loadTargetNumbers();
      const oldCount = TARGET_PHONE_NUMBERS.length;
      const newCount = newTargetNumbers.length;
      
      // Find new numbers that weren't in the previous list
      const newNumbers = newTargetNumbers.filter(num => !TARGET_PHONE_NUMBERS.includes(num));
      
      TARGET_PHONE_NUMBERS = newTargetNumbers;
      
      console.log(`📊 Reloaded: Old ${oldCount} → New ${newCount} → Added ${newNumbers.length}`);
      
      // Send welcome messages to newly added numbers
      if (newNumbers.length > 0) {
        console.log('🎯 Sending welcome to newly added numbers:', newNumbers);
        for (const phoneNumber of newNumbers) {
          try {
            const whatsappId = `${phoneNumber}@c.us`;
            
            // Check if this user already has an active session or completed conversation
            // OR has already received a welcome message
            if (!userSessions.has(whatsappId) && !welcomeSentNumbers.has(whatsappId)) {
              await sendAutoWelcomeMessage(whatsappId);
              await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
            } else {
              console.log(`⏭️  Skipping ${phoneNumber} - already has active session or welcome sent`);
            }
          } catch (error) {
            console.error(`❌ Failed to send welcome to new number ${phoneNumber}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('💥 Error reloading target numbers:', error.message);
    }
  });
  
  console.log(`\n👀 Watching ${TARGET_NUMBERS_FILE} for changes...`);
  console.log('🚀 Smart session management activated');
});

// Enhanced message handler with comprehensive keyword analysis
client.on('message', async (message) => {
  try {
    const from = message.from;
    const body = message.body.trim();
    
    // Ignore messages from status broadcasts and groups
    if (message.from.includes('status') || message.from.includes('@g.us')) {
      return;
    }
    
    // Only process messages from target numbers
    if (!isTargetPhoneNumber(from)) {
      return;
    }
    
    // 🔍 COMPREHENSIVE KEYWORD ANALYSIS
    console.log(`\n📨 Processing message from ${extractPhoneNumber(from)}: "${body}"`);
    
    // Run comprehensive keyword analysis on every message
    const comprehensiveAnalysis = analyzeComprehensiveSentiment(body, 'general');
    const keywordData = comprehensiveAnalysis.keywords;
    
    // Log comprehensive analysis results
    console.log(`🎯 Message Analysis Results:`);
    console.log(`   Sentiment: ${comprehensiveAnalysis.sentiment} (confidence: ${comprehensiveAnalysis.confidence})`);
    console.log(`   Tone: ${keywordData.overall.tone}`);
    console.log(`   Characteristics: ${JSON.stringify(keywordData.overall, null, 2)}`);
    
    // Handle special keyword-based responses
    if (keywordData.overall.isGreeting && !keywordData.overall.hasReason) {
      console.log(`👋 Greeting detected without specific reason - treating as conversation restart`);
    }
    
    if (keywordData.overall.isFarewell) {
      console.log(`👋 Farewell detected - user may be ending conversation`);
      // Could add special farewell handling here
    }
    
    if (keywordData.overall.needsHelp) {
      console.log(`🤔 User needs help/clarification - adjusting response strategy`);
      // Could add special help/clarification handling here
    }
    
    if (keywordData.overall.isUrgent) {
      console.log(`🚨 Urgent request detected - prioritizing response`);
      // Could add urgent handling logic here
    }
    
    if (keywordData.overall.needsCancellation) {
      console.log(`📅 Cancellation/rescheduling request detected`);
      // Could add cancellation handling logic here
    }
    
    let session = userSessions.get(from);
    
    // Update session activity and message count
    if (session) {
      session.lastActivity = new Date();
      session.metadata.messageCount = (session.metadata.messageCount || 0) + 1;
      
      // Save on important milestones (every 5 messages)
      if (session.metadata.messageCount % 5 === 0) {
        sessionManager.markForSave(from, 'milestone');
      } else {
        sessionManager.markForSave(from, 'message');
      }
    } else if (!welcomeSentNumbers.has(from)) {
      // This is a target number that hasn't received welcome yet
      await sendAutoWelcomeMessage(from);
      return;
    }
    
    // If user has no session BUT welcome was already sent, ignore
    if (!session) {
      return;
    }
    
    // Check if user has an IDLE session (said "no" previously) and wants to restart
    if (session.state === CONVERSATION_STATES.IDLE) {
      // User with IDLE session sent a message - restart the conversation
      await handleGreeting(message);
      return;
    }

    // Handle conversation flow for existing sessions
    switch (session.state) {
      case CONVERSATION_STATES.GREETING:
        await handleInitialResponse(message, session, body);
        break;
      case CONVERSATION_STATES.WAITING_INITIAL_RESPONSE:
        await handleInitialResponse(message, session, body);
        break;
      case CONVERSATION_STATES.CLARIFYING_RESPONSE:
        await handleClarificationResponse(message, session, body);
        break;
      case CONVERSATION_STATES.ASKING_REASON:
        await handleReasonResponse(message, session, body);
        break;
      case CONVERSATION_STATES.ASKING_CALL_TIME:
        await handleCallTimeResponse(message, session, body);
        break;
      case CONVERSATION_STATES.ASKING_DATE:
        await handleDateResponse(message, session, body);
        break;
      case CONVERSATION_STATES.ASKING_TIME:
        await handleTimeResponse(message, session, body);
        break;
      case CONVERSATION_STATES.CONFIRMING_SCHEDULE:
        await handleScheduleConfirmation(message, session, body);
        break;
      default:
        // Ignore messages in unknown states
        break;
    }

  } catch (error) {
    console.error('Error handling message:', error);
    // Don't reveal server issues to users
    await message.reply('Please try again.');
  }
});

// Greeting handler for restarting conversations
async function handleGreeting(message) {
  const greeting = `👋 Hi, this is your assistant from CovanEdu.com. We'd like to schedule a call to discuss how we can help you. May I ask a few quick questions to schedule the best time for you?\n\nPlease reply with *yes* to continue.`;
  
  await message.reply(greeting);
  
  createOrUpdateSession(message.from, {
    state: CONVERSATION_STATES.WAITING_INITIAL_RESPONSE,
    currentQuestion: 'initial_response'
  });
}

// Handle initial response using sentiment analysis
async function handleInitialResponse(message, session, body) {
  try {
    const sentiment = await analyzeSentiment(body, 'yes_no_question');
    
    if (sentiment === 'positive') {
      // User said yes, proceed to ask for call time
      await message.reply(config.getMessage('messages.questions.askCallTime'));
      
      createOrUpdateSession(message.from, {
        state: CONVERSATION_STATES.ASKING_CALL_TIME,
        currentQuestion: 'call_time'
      });
      
    } else if (sentiment === 'negative') {
      // User said no, ask for reason
      await message.reply(config.getMessage('messages.questions.askReason'));
      
      createOrUpdateSession(message.from, {
        state: CONVERSATION_STATES.ASKING_REASON,
        currentQuestion: 'reason'
      });
      
    } else {
      // Neutral or unclear response, ask for clarification
      await message.reply(config.getMessage('messages.questions.askClarification'));
      
      createOrUpdateSession(message.from, {
        state: CONVERSATION_STATES.CLARIFYING_RESPONSE,
        currentQuestion: 'clarification',
        clarificationAttempts: (session.clarificationAttempts || 0) + 1
      });
    }
    
  } catch (error) {
    console.error('Error in handleInitialResponse:', error);
    await message.reply(config.getMessage('messages.errors.clarificationNeeded'));
  }
}

// Handle clarification response
async function handleClarificationResponse(message, session, body) {
  try {
    const sentiment = await analyzeSentiment(body, 'yes_no_question');
    
    if (sentiment === 'positive') {
      // User clarified yes, proceed to ask for call time
      await message.reply(config.getMessage('messages.questions.askCallTime'));
      
      createOrUpdateSession(message.from, {
        state: CONVERSATION_STATES.ASKING_CALL_TIME,
        currentQuestion: 'call_time',
        clarificationAttempts: 0
      });
      
    } else if (sentiment === 'negative') {
      // User clarified no, ask for reason
      await message.reply(config.getMessage('messages.questions.askReason'));
      
      createOrUpdateSession(message.from, {
        state: CONVERSATION_STATES.ASKING_REASON,
        currentQuestion: 'reason',
        clarificationAttempts: 0
      });
      
    } else {
      // Still unclear after clarification attempt - keep trying unlimited times
      await message.reply(config.getMessage('messages.errors.stillUnclear'));
      
      createOrUpdateSession(message.from, {
        clarificationAttempts: (session.clarificationAttempts || 0) + 1
      });
    }
    
  } catch (error) {
    console.error('Error in handleClarificationResponse:', error);
    await message.reply(config.getMessage('messages.errors.clarificationNeeded'));
  }
}

// Handle reason response (when user says no)
async function handleReasonResponse(message, session, body) {
  try {
    // Save the reason and end conversation gracefully
    const phoneNumber = extractPhoneNumber(message.from);
    
    // Reason saved in session data
    
    await message.reply(config.getMessage('messages.success.thankYou'));
    
    createOrUpdateSession(message.from, {
      state: CONVERSATION_STATES.COMPLETED,
      currentQuestion: 'completed'
    });
    
    // Mark session as completed
    sessionManager.markForSave(message.from, 'completion');
    
  } catch (error) {
    console.error('Error in handleReasonResponse:', error);
    await message.reply(config.getMessage('messages.success.thankYou'));
  }
}

// Handle call time response with interactive prompting
async function handleCallTimeResponse(message, session, body) {
  try {
    const currentDateTime = new Date();
    const timeParseResult = await parseTimeExpression(body, currentDateTime);
    
    if (timeParseResult.success && timeParseResult.complete) {
      // Check if the date/time is in the past (but skip for immediate keywords)
      if (!timeParseResult.immediate && await handlePastDateTimeValidation(message, timeParseResult.date, timeParseResult.time, currentDateTime, body)) {
        return; // Past date detected and handled, user redirected
      }
      
      // Check for time conflicts before proceeding
      const phoneNumber = extractPhoneNumber(message.from);
      const conflictCheck = checkTimeConflict(timeParseResult.date, timeParseResult.time, phoneNumber);
      
      if (conflictCheck.hasConflict) {
        // Time slot is already occupied
        await message.reply(`I'm sorry, but that time slot is already occupied. There's another call scheduled for ${conflictCheck.conflictingDateTime}. Please choose a different date and time.`);
        
        // Restart the process by asking for call time again
        await message.reply(config.getMessage('messages.questions.askCallTime'));
        
        createOrUpdateSession(message.from, {
          state: CONVERSATION_STATES.ASKING_CALL_TIME,
          currentQuestion: 'call_time',
          partialSchedule: null,
          pendingSchedule: null
        });
        
        return;
      }
      
      // Handle immediate keywords - skip confirmation and schedule directly
      if (timeParseResult.immediate) {
        const scheduleData = {
          date: timeParseResult.date,
          time: timeParseResult.time,
          formatted: timeParseResult.formatted,
          originalText: body,
          scheduledAt: new Date().toISOString(),
          immediate: true
        };
        
        saveCallSchedule(phoneNumber, scheduleData);
        
        const formattedTime = moment(`${timeParseResult.date} ${timeParseResult.time}`, 'DD/MM/YYYY HH:mm').format('dddd, MMMM Do [at] h:mm A');
        
        await message.reply(config.getMessage('messages.success.immediateCallScheduled').replace('{time}', formattedTime));
        
        createOrUpdateSession(message.from, {
          state: CONVERSATION_STATES.COMPLETED,
          currentQuestion: 'completed',
          finalSchedule: scheduleData,
          completedAt: new Date().toISOString()
        });
        
        return;
      }
      
      // Successfully parsed both date and time, confirm with user (for non-immediate requests)
      const formattedTime = moment(`${timeParseResult.date} ${timeParseResult.time}`, 'DD/MM/YYYY HH:mm').format('dddd, MMMM Do [at] h:mm A');
      
      await message.reply(config.getMessage('messages.confirmations.scheduleConfirm').replace('{formattedTime}', formattedTime));
      
      createOrUpdateSession(message.from, {
        state: CONVERSATION_STATES.CONFIRMING_SCHEDULE,
        currentQuestion: 'schedule_confirmation',
        pendingSchedule: {
          date: timeParseResult.date,
          time: timeParseResult.time,
          formatted: timeParseResult.formatted,
          originalText: body
        }
      });
      
    } else if (timeParseResult.success && timeParseResult.partial) {
      // Partial parsing - missing either date or time
      if (timeParseResult.hasDate && !timeParseResult.hasTime) {
        // Has date but missing time
        const dateFormatted = moment(timeParseResult.date, 'DD/MM/YYYY').format('dddd, MMMM Do');
        await message.reply(config.getMessage('messages.questions.askTimeForDate').replace('{date}', dateFormatted));
        
        createOrUpdateSession(message.from, {
          state: CONVERSATION_STATES.ASKING_TIME,
          currentQuestion: 'time_needed',
          partialSchedule: {
            date: timeParseResult.date,
            hasDate: true,
            hasTime: false,
            originalText: body
          }
        });
        
      } else if (timeParseResult.hasTime && !timeParseResult.hasDate) {
        // Has time but missing date
        const timeFormatted = moment(timeParseResult.time, 'HH:mm').format('h:mm A');
        await message.reply(config.getMessage('messages.questions.askDateForTime').replace('{time}', timeFormatted));
        
        createOrUpdateSession(message.from, {
          state: CONVERSATION_STATES.ASKING_DATE,
          currentQuestion: 'date_needed',
          partialSchedule: {
            time: timeParseResult.time,
            hasDate: false,
            hasTime: true,
            originalText: body
          }
        });
        
      } else {
        // Neither date nor time found
        await message.reply(config.getMessage('messages.prompts.provideDateAndTime'));
      }
      
    } else {
      // Failed to parse anything meaningful
      await message.reply(config.getMessage('messages.prompts.provideDateAndTime'));
    }
    
  } catch (error) {
    console.error('Error in handleCallTimeResponse:', error);
    await message.reply(config.getMessage('messages.errors.parseError'));
  }
}

// Handle date response when time was already provided
async function handleDateResponse(message, session, body) {
  try {
    const currentDateTime = new Date();
    const timeParseResult = await parseTimeExpression(body, currentDateTime);
    
    if (timeParseResult.success && timeParseResult.hasDate) {
      // Successfully got the date, combine with existing time
      const combinedDate = timeParseResult.date;
      const combinedTime = session.partialSchedule.time;
      
      // Check if the combined date/time is in the past
      if (await handlePastDateTimeValidation(message, combinedDate, combinedTime, currentDateTime, body)) {
        return; // Past date detected and handled, user redirected
      }
      
      const formattedTime = moment(`${combinedDate} ${combinedTime}`, 'DD/MM/YYYY HH:mm').format('dddd, MMMM Do [at] h:mm A');
      
      await message.reply(`Perfect! Just to confirm, you'd like me to call on ${formattedTime}, right?`);
      
      createOrUpdateSession(message.from, {
        state: CONVERSATION_STATES.CONFIRMING_SCHEDULE,
        currentQuestion: 'schedule_confirmation',
        pendingSchedule: {
          date: combinedDate,
          time: combinedTime,
          formatted: `${combinedDate}::${combinedTime}`,
          originalText: `${session.partialSchedule.originalText} + ${body}`
        }
      });
      
    } else {
      // Failed to get date, ask again
      await message.reply("I didn't catch a specific date. Could you please provide a date? For example: 'today', 'tomorrow', or 'Monday'");
    }
    
  } catch (error) {
    console.error('Error in handleDateResponse:', error);
    await message.reply("Sorry, I didn't catch that. Could you please provide a date?");
  }
}

// Handle time response when date was already provided
async function handleTimeResponse(message, session, body) {
  try {
    const currentDateTime = new Date();
    const timeParseResult = await parseTimeExpression(body, currentDateTime);
    
    if (timeParseResult.success && timeParseResult.hasTime) {
      // Successfully got the time, combine with existing date
      const combinedDate = session.partialSchedule.date;
      const combinedTime = timeParseResult.time;
      
      // Check if the combined date/time is in the past
      if (await handlePastDateTimeValidation(message, combinedDate, combinedTime, currentDateTime, body)) {
        return; // Past date detected and handled, user redirected
      }
      
      // Check for time conflicts with existing bookings
      const phoneNumber = extractPhoneNumber(message.from);
      const conflictCheck = checkTimeConflict(combinedDate, combinedTime, phoneNumber);
      
      if (conflictCheck.hasConflict) {
        // Time slot is already occupied
        await message.reply(`I'm sorry, but that time slot is already occupied. There's another call scheduled for ${conflictCheck.conflictingDateTime}. Please choose a different date and time.`);
        
        // Restart the process by asking for date again
        await message.reply(config.getMessage('messages.questions.askDate'));
        
        createOrUpdateSession(message.from, {
          state: CONVERSATION_STATES.ASKING_DATE,
          currentQuestion: 'date',
          partialSchedule: null,
          pendingSchedule: null
        });
        
        return;
      }
      
      const formattedTime = moment(`${combinedDate} ${combinedTime}`, 'DD/MM/YYYY HH:mm').format('dddd, MMMM Do [at] h:mm A');
      
      await message.reply(`Excellent! Just to confirm, you'd like me to call on ${formattedTime}, right?`);
      
      createOrUpdateSession(message.from, {
        state: CONVERSATION_STATES.CONFIRMING_SCHEDULE,
        currentQuestion: 'schedule_confirmation',
        pendingSchedule: {
          date: combinedDate,
          time: combinedTime,
          formatted: `${combinedDate}::${combinedTime}`,
          originalText: `${session.partialSchedule.originalText} + ${body}`
        }
      });
      
    } else {
      // Failed to get time, ask again
      await message.reply("I didn't catch a specific time. Could you please provide a time? For example: '2pm', 'morning', or 'afternoon'");
    }
    
  } catch (error) {
    console.error('Error in handleTimeResponse:', error);
    await message.reply("Sorry, I didn't catch that. Could you please provide a time?");
  }
}

// Handle schedule confirmation
async function handleScheduleConfirmation(message, session, body) {
  try {
    const sentiment = await analyzeSentiment(body, 'yes_no_question');
    
    if (sentiment === 'positive') {
      // User confirmed the schedule - perform final conflict check
      const phoneNumber = extractPhoneNumber(message.from);
      const finalConflictCheck = checkTimeConflict(
        session.pendingSchedule.date, 
        session.pendingSchedule.time, 
        phoneNumber
      );
      
      if (finalConflictCheck.hasConflict) {
        // Last-minute conflict detected (race condition)
        await message.reply(`I'm sorry, but that time slot was just booked by someone else. There's now a call scheduled for ${finalConflictCheck.conflictingDateTime}. Let's find you another time.`);
        
        // Restart the process by asking for date again
        await message.reply(config.getMessage('messages.questions.askDate'));
        
        createOrUpdateSession(message.from, {
          state: CONVERSATION_STATES.ASKING_DATE,
          currentQuestion: 'date',
          partialSchedule: null,
          pendingSchedule: null
        });
        
        return;
      }
      
      const scheduleData = {
        date: session.pendingSchedule.date,
        time: session.pendingSchedule.time,
        formatted: session.pendingSchedule.formatted,
        originalRequest: session.pendingSchedule.originalText,
        confirmedAt: new Date().toISOString()
      };
      
      // Save to call schedule
      saveCallSchedule(phoneNumber, scheduleData);
      
      // Call schedule saved to call_schedule.json
      
      await message.reply(config.getMessage('messages.success.callScheduled'));
      
      createOrUpdateSession(message.from, {
        state: CONVERSATION_STATES.COMPLETED,
        currentQuestion: 'completed'
      });
      
      // Mark session as completed
      sessionManager.markForSave(message.from, 'completion');
      
    } else {
      // User wants to change the time, go back to asking for call time
      await message.reply(config.getMessage('messages.questions.askCallTime'));
      
      createOrUpdateSession(message.from, {
        state: CONVERSATION_STATES.ASKING_CALL_TIME,
        currentQuestion: 'call_time',
        pendingSchedule: null
      });
    }
    
  } catch (error) {
    console.error('Error in handleScheduleConfirmation:', error);
    await message.reply(config.getMessage('messages.errors.confirmationNeeded'));
  }
}

// Removed old conversation handlers - using simplified flow with sentiment analysis

// Add monitoring to track save performance
setInterval(() => {
  const activeSessions = userSessions.size;
  const saveQueueSize = sessionManager.saveQueue.size;
  
  // Log save frequency statistics
  if (sessionManager.lastSaveTime) {
    const timeSinceLastSave = new Date() - sessionManager.lastSaveTime;
  }
}, 60000); // Log every minute

// Start the client
client.initialize();

console.log('WhatsApp Bot is initializing...');