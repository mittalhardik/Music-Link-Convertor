// server.js
// A simple Express server to handle music link conversions.

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const YoutubeMusicApi = require('youtube-music-api');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// --- API CLIENT INITIALIZATION ---

// Load environment variables
require('dotenv').config();

// Spotify API credentials
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'c245ea30ad4249a5b507c557954e60b3';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'b9cd3588cfc74574a3d775a853c358b6';



// YouTube Music API
const ytMusicApi = new YoutubeMusicApi();

// --- HELPER FUNCTIONS ---

/**
 * Gets an access token from Spotify.
 * These tokens are short-lived. In a production app, you should cache this.
 */
async function getSpotifyToken() {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await axios.post('https://accounts.spotify.com/api/token', params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + (Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'))
        }
    });
    return response.data.access_token;
}

// --- CORE API LOGIC ---

/**
 * Fetches track metadata from Spotify using a track ID.
 */
async function getSpotifyTrackDetails(trackId) {
    const token = await getSpotifyToken();
    const { data } = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return {
        title: data.name,
        artist: data.artists[0].name,
        album: data.album.name,
        isrc: data.external_ids.isrc // ISRC is a universal code for recordings
    };
}



/**
 * Fetches track metadata from YouTube Music using a video ID.
 * Since the API doesn't support direct video lookup, we'll try to get info from YouTube.
 */
async function getYouTubeMusicTrackDetails(videoId) {
    try {
        // Try to get video info from YouTube using a simple approach
        const response = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (response.data && response.data.title) {
            // Extract artist and title from the video info
            const title = response.data.title;
            const author = response.data.author_name;
            
            // If author contains " - Topic", it's likely the artist
            if (author && author.includes(' - Topic')) {
                const artist = author.replace(' - Topic', '').trim();
                return {
                    title: title,
                    artist: artist,
                    album: null,
                    isrc: null
                };
            } else if (author) {
                // Use the author as artist
                return {
                    title: title,
                    artist: author,
                    album: null,
                    isrc: null
                };
            } else {
                // Try to parse title for "Artist - Song" pattern
                const parts = title.split(' - ');
                if (parts.length >= 2) {
                    return {
                        title: parts[1].trim(),
                        artist: parts[0].trim(),
                        album: null,
                        isrc: null
                    };
                } else {
                    return {
                        title: title,
                        artist: 'Unknown Artist',
                        album: null,
                        isrc: null
                    };
                }
            }
        }
    } catch (error) {
        console.error("Error fetching YouTube video info:", error.message);
    }
    
    // Fallback to placeholder if we can't get the info
    return {
        title: `YouTube Music Track (${videoId})`,
        artist: 'Unknown Artist',
        album: null,
        isrc: null
    };
}


/**
 * Searches for a track on other platforms based on metadata.
 */
async function findLinks(metadata) {
    const query = `${metadata.title} ${metadata.artist}`;
    const links = {};

    // Search on Spotify
    try {
        const token = await getSpotifyToken();
        const response = await axios.get('https://api.spotify.com/v1/search', {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { q: query, type: 'track', limit: 5 }
        });
        if (response.data.tracks.items.length > 0) {
            // Try to find the best match by comparing title and artist
            const bestMatch = response.data.tracks.items.find(track => 
                track.name.toLowerCase().includes(metadata.title.toLowerCase()) ||
                metadata.title.toLowerCase().includes(track.name.toLowerCase())
            ) || response.data.tracks.items[0];
            
            links.spotify = bestMatch.external_urls.spotify;
        }
    } catch (error) {
        console.error("Error searching Spotify:", error.message);
    }



    // Search on YouTube Music
    try {
        await ytMusicApi.initalize();
        const response = await ytMusicApi.search(query, "song");
        if (response.content && response.content.length > 0) {
            // Try to find the best match by comparing titles
            const bestMatch = response.content.find(item => 
                item.name && (
                    item.name.toLowerCase().includes(metadata.title.toLowerCase()) ||
                    metadata.title.toLowerCase().includes(item.name.toLowerCase())
                )
            ) || response.content[0];
            
            const videoId = bestMatch.videoId;
            links.youtubeMusic = `https://music.youtube.com/watch?v=${videoId}`;
        }
    } catch (error) {
        console.error("Error searching YouTube Music:", error.message);
    }

    return links;
}


// --- API ENDPOINT ---

app.post('/convert', async (req, res) => {
    const { link } = req.body;
    if (!link) {
        return res.status(400).json({ error: 'Link is required' });
    }

    try {
        let metadata;
        let source;

        if (link.includes('spotify.com')) {
            const trackId = link.match(/track\/([a-zA-Z0-9]+)/)[1];
            metadata = await getSpotifyTrackDetails(trackId);
            source = 'Spotify';
        } else if (link.includes('music.youtube.com') || link.includes('youtube.com')) {
            const videoId = link.match(/v=([a-zA-Z0-9_-]+)/)[1];
            metadata = await getYouTubeMusicTrackDetails(videoId);
            source = 'YouTube Music';
        } else {
            return res.status(400).json({ error: 'Unsupported link provider. Please use Spotify or YouTube Music links.' });
        }

        const links = await findLinks(metadata);
        
        // Ensure the original link is also present
        if (source === 'Spotify') links.spotify = link;
        if (source === 'YouTube Music') links.youtubeMusic = link;

        res.json({ source, links });

    } catch (error) {
        console.error('Conversion error:', error);
        res.status(500).json({ error: 'Failed to convert link. The API might be down or the link is invalid.' });
    }
});


// Debug endpoint to test search functionality
app.get('/debug/search/:platform', async (req, res) => {
    const { platform } = req.params;
    const { q } = req.query;
    
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    try {
        if (platform === 'spotify') {
            const token = await getSpotifyToken();
            const response = await axios.get('https://api.spotify.com/v1/search', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { q, type: 'track', limit: 5 }
            });
            res.json({
                query: q,
                results: response.data.tracks.items.map(item => ({
                    name: item.name,
                    artist: item.artists[0].name,
                    url: item.external_urls.spotify
                }))
            });
        } else if (platform === 'youtube') {
            await ytMusicApi.initalize();
            const response = await ytMusicApi.search(q, "song");
            res.json({
                query: q,
                results: response.content ? response.content.slice(0, 5).map(item => ({
                    name: item.name,
                    artist: item.artist ? item.artist.name : 'Unknown',
                    videoId: item.videoId
                })) : []
            });
        } else {
            res.status(400).json({ error: 'Unsupported platform' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to test YouTube video metadata extraction
app.get('/debug/youtube/:videoId', async (req, res) => {
    const { videoId } = req.params;
    
    try {
        const metadata = await getYouTubeMusicTrackDetails(videoId);
        res.json({
            videoId,
            extractedMetadata: metadata
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint for Cloud Run
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'music-link-converter'
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Music Converter backend listening at http://localhost:${port}`);
    console.log(`Frontend available at http://localhost:${port}`);
}); 