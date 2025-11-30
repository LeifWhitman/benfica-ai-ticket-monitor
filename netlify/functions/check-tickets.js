const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { query, web_search = true } = JSON.parse(event.body);
        
        if (!query) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: 'Query is required',
                    success: false 
                })
            };
        }

        const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
        
        if (!DEEPSEEK_API_KEY) {
            throw new Error('DeepSeek API key not configured');
        }

        const systemPrompt = \You are an AI assistant specialized in finding real-time ticket availability for SL Benfica matches. 
        Use web search to find current ticket information from official sources and trusted partners.
        Provide a concise summary that includes:
        - Current availability status
        - Official sources and links
        - Any relevant dates, prices, or restrictions
        - Clear indication if tickets are available for purchase
        
        Focus on accuracy and timeliness. If tickets are available, mention it clearly.\;

        const payload = {
            model: "deepseek-chat",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: \Find current ticket availability for: "\". Search official SL Benfica websites and provide real-time availability status with sources.\
                }
            ],
            web_search: web_search,
            max_tokens: 1000,
            temperature: 0.3
        };

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': \Bearer \\
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(\DeepSeek API error: \ - \\);
        }

        const data = await response.json();
        
        let generatedText = "No clear information found for this match. The AI search didn't return specific availability data.";
        let sources = [];

        if (data.choices && data.choices[0] && data.choices[0].message) {
            generatedText = data.choices[0].message.content;
            sources = extractSourcesFromText(generatedText);
        }

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: generatedText,
                sources: sources,
                success: true,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Server Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: error.message,
                success: false
            })
        };
    }
};

function extractSourcesFromText(text) {
    const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
    const urls = text.match(urlRegex) || [];
    
    return urls.slice(0, 5).map(url => ({
        uri: url.replace(/[.,)!?]\$/, ''),
        title: getDomainFromUrl(url) + ' Ticket Source'
    })).filter(source => 
        !source.uri.includes('deepseek.com') &&
        !source.uri.includes('localhost') &&
        source.uri.startsWith('http')
    );
}

function getDomainFromUrl(url) {
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        return domain.split('.')[0];
    } catch {
        return 'Official';
    }
}
