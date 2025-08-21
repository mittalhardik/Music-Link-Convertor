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
        artist: data.artists.map(a => a.name).join(', '), // Include all artists
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
                // Clean up the title by removing common suffixes and prefixes
                let cleanTitle = title;
                // Remove album info in parentheses at the end
                cleanTitle = cleanTitle.replace(/\s*\([^)]*\)\s*$/, '');
                // Remove "From the Album" text
                cleanTitle = cleanTitle.replace(/\s*\(From the Album "[^"]*"\)\s*/, '');
                
                return {
                    title: cleanTitle,
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
    const links = {};

    // Clean up metadata for better search
    const cleanTitle = metadata.title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
    const cleanArtist = metadata.artist.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
    
    // Create multiple search queries for better matching
    const searchQueries = [
        `${cleanTitle} ${cleanArtist}`,
        `${cleanArtist} ${cleanTitle}`,
        cleanTitle,
        `${cleanTitle} artist:${cleanArtist}`,
        `${cleanTitle} ${cleanArtist} Saiyaara`, // Add movie name for better matching
        `${cleanTitle} movie Saiyaara`
    ];
    
    console.log('Search queries:', searchQueries);
    console.log('Clean title:', cleanTitle);
    console.log('Clean artist:', cleanArtist);

    // Search on Spotify
    try {
        const token = await getSpotifyToken();
        let bestSpotifyMatch = null;
        let bestSpotifyScore = 0;

        for (const query of searchQueries) {
            const response = await axios.get('https://api.spotify.com/v1/search', {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { q: query, type: 'track', limit: 10 }
            });
            
            if (response.data.tracks.items.length > 0) {
                for (const track of response.data.tracks.items) {
                    const score = calculateMatchScore(track.name, track.artists[0].name, cleanTitle, cleanArtist);
                    if (score > bestSpotifyScore && score > 0.5) { // Lower threshold to 50% for better matching
                        bestSpotifyScore = score;
                        bestSpotifyMatch = track;
                    }
                }
            }
        }
        
        if (bestSpotifyMatch) {
            links.spotify = bestSpotifyMatch.external_urls.spotify;
        }
    } catch (error) {
        console.error("Error searching Spotify:", error.message);
    }

    // Search on YouTube Music
    try {
        await ytMusicApi.initalize();
        let bestYouTubeMatch = null;
        let bestYouTubeScore = 0;

        for (const query of searchQueries.slice(0, 3)) { // Use first 3 queries for YouTube
            console.log(`Searching YouTube with query: "${query}"`);
            const response = await ytMusicApi.search(query, "song");
            if (response.content && response.content.length > 0) {
                console.log(`Found ${response.content.length} results for query: "${query}"`);
                for (const item of response.content.slice(0, 5)) {
                    // Add proper null checks and debugging
                    if (item && item.name && item.videoId) {
                        try {
                            // Handle both single artist and multiple artists
                            let artistName = '';
                            if (Array.isArray(item.artist)) {
                                if (item.artist.length > 0) {
                                    // Multiple artists - join them
                                    artistName = item.artist.map(a => a.name).join(', ');
                                } else {
                                    // Empty artist array - use album name as fallback
                                    artistName = item.album && item.album.name ? item.album.name : 'Unknown Artist';
                                }
                            } else if (item.artist && item.artist.name) {
                                // Single artist
                                artistName = item.artist.name;
                            } else {
                                // No artist info - use album name as fallback
                                artistName = item.album && item.album.name ? item.album.name : 'Unknown Artist';
                            }
                            
                            const score = calculateMatchScore(item.name, artistName, cleanTitle, cleanArtist);
                            console.log(`Score for "${item.name}" by "${artistName}": ${score}`);
                            if (score > bestYouTubeScore && score > 0.5) { // Lower threshold to 50% for better matching
                                bestYouTubeScore = score;
                                bestYouTubeMatch = item;
                                console.log(`New best match: "${item.name}" by "${artistName}" with score ${score}`);
                            }
                        } catch (scoreError) {
                            console.error("Error calculating score for YouTube item:", scoreError.message);
                            continue;
                        }
                    } else {
                        // Log the structure of items that don't have the expected properties
                        console.log("YouTube item structure:", JSON.stringify(item, null, 2));
                    }
                }
            } else {
                console.log(`No results found for query: "${query}"`);
            }
        }
        
        if (bestYouTubeMatch) {
            const videoId = bestYouTubeMatch.videoId;
            links.youtubeMusic = `https://music.youtube.com/watch?v=${videoId}`;
        }
    } catch (error) {
        console.error("Error searching YouTube Music:", error.message);
    }

    return links;
}

/**
 * Calculate a match score between two track/artist pairs.
 * Returns a score between 0 and 1, where 1 is a perfect match.
 */
function calculateMatchScore(trackName1, artistName1, trackName2, artistName2) {
    const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    const normalizedTrack1 = normalize(trackName1);
    const normalizedTrack2 = normalize(trackName2);
    
    // Handle multiple artists - split by comma, '&', 'and', etc.
    const artists1 = artistName1.split(/[,&]|\sand\s/).map(a => normalize(a.trim())).filter(a => a);
    const artists2 = artistName2.split(/[,&]|\sand\s/).map(a => normalize(a.trim())).filter(a => a);
    
    // Calculate track name similarity
    let trackScore = 0;
    if (normalizedTrack1 === normalizedTrack2) {
        trackScore = 1;
    } else if (normalizedTrack1.includes(normalizedTrack2) || normalizedTrack2.includes(normalizedTrack1)) {
        trackScore = 0.8;
    } else {
        // Use simple word overlap
        const words1 = normalizedTrack1.split(/\s+/);
        const words2 = normalizedTrack2.split(/\s+/);
        const commonWords = words1.filter(word => words2.includes(word));
        if (words1.length > 0 && words2.length > 0) {
            trackScore = (commonWords.length / Math.max(words1.length, words2.length)) * 0.6;
        }
    }
    
    // Special handling for cases where one track has additional info like "(feat. X)"
    // Check if the core track name (first few words) matches
    const coreWords1 = normalizedTrack1.split(/\s+/).slice(0, 3); // First 3 words
    const coreWords2 = normalizedTrack2.split(/\s+/).slice(0, 3); // First 3 words
    const coreMatch = coreWords1.some(word => coreWords2.includes(word)) && 
                     coreWords2.some(word => coreWords1.includes(word));
    
    if (coreMatch && trackScore < 0.6) {
        trackScore = Math.max(trackScore, 0.6); // Boost score for core word matches
    }
    
    // Calculate artist similarity for multiple artists
    let artistScore = 0;
    
    // Check for exact matches between any artist pairs
    const exactMatches = artists1.filter(a1 => artists2.includes(a1)).length;
    const partialMatches = artists1.filter(a1 => 
        artists2.some(a2 => a1.includes(a2) || a2.includes(a1))
    ).length;
    
    if (exactMatches > 0) {
        // If there are exact matches, calculate score based on match ratio
        artistScore = Math.min(1, (exactMatches / Math.max(artists1.length, artists2.length)) * 1.2);
    } else if (partialMatches > 0) {
        // If there are partial matches, give a lower score
        artistScore = Math.min(0.8, (partialMatches / Math.max(artists1.length, artists2.length)) * 0.8);
    } else {
        // Fallback to simple word overlap for single artist comparison
        const words1 = artists1.join(' ').split(/\s+/);
        const words2 = artists2.join(' ').split(/\s+/);
        const commonWords = words1.filter(word => words2.includes(word));
        if (words1.length > 0 && words2.length > 0) {
            artistScore = (commonWords.length / Math.max(words1.length, words2.length)) * 0.6;
        }
    }
    
    // Combined score (weighted average: 70% track, 30% artist)
    return (trackScore * 0.7) + (artistScore * 0.3);
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

// New endpoint that calls the existing /convert API and modifies its response
app.post('/convert-single', async (req, res) => {
    try {
        // Make an internal HTTP request to the existing /convert endpoint
        const response = await axios.post(`http://localhost:${port}/convert`, req.body, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Extract the response data from the existing endpoint
        const { source, links } = response.data;
        
        // Find a link from a different platform than the source
        let alternativeLink = null;
        if (source === 'Spotify' && links.youtubeMusic) {
            alternativeLink = links.youtubeMusic;
        } else if (source === 'YouTube Music' && links.spotify) {
            alternativeLink = links.spotify;
        }

        if (alternativeLink) {
            res.set('Content-Type', 'text/plain');
            res.send(alternativeLink);
        } else {
            res.status(404).send('No alternative link found');
        }

    } catch (error) {
        console.error('Error calling /convert endpoint:', error.message);
        if (error.response) {
            // Forward the error from the original endpoint
            res.status(error.response.status).send(error.response.data.error || 'Conversion failed');
        } else {
            res.status(500).send('Failed to convert link. The API might be down or the link is invalid.');
        }
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

// Debug endpoint to test YouTube Music search with raw response
app.get('/debug/youtube-search/:query', async (req, res) => {
    const { query } = req.params;
    
    try {
        await ytMusicApi.initalize();
        const response = await ytMusicApi.search(query, "song");
        res.json({
            query,
            rawResponse: response,
            content: response.content ? response.content.slice(0, 3) : []
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