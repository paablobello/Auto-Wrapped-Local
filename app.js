require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SpotifyWebApi = require('spotify-web-api-node');

const app = express();

// ...resto de tu configuración de Express y rutas


// Configuración de Spotify API
const spotifyApi = new SpotifyWebApi({
    redirectUri: process.env.REDIRECT_URI,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET
});

// Configuración de Express y sesiones
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'mi secreto', resave: false, saveUninitialized: true }));
app.set('view engine', 'ejs');

// Ruta principal
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta de autenticación de Spotify
app.get('/login', (req, res) => {
    const scopes = ['user-read-private', 'user-read-email', 'user-top-read', 'playlist-modify-public', 'playlist-modify-private'];
    res.redirect(spotifyApi.createAuthorizeURL(scopes));
});


// Callback de autenticación
app.get('/callback', (req, res) => {
    const error = req.query.error;
    const code = req.query.code;

    if (error) {
        console.error('Callback Error:', error);
        res.send(`Callback Error: ${error}`);
        return;
    }

    spotifyApi.authorizationCodeGrant(code).then(data => {
        const accessToken = data.body['access_token'];
        const refreshToken = data.body['refresh_token'];

        // Aquí se establecen los tokens en la sesión
        req.session.accessToken = accessToken;
        req.session.refreshToken = refreshToken;

        spotifyApi.setAccessToken(accessToken);
        spotifyApi.setRefreshToken(refreshToken);

        res.redirect('/dashboard');
    }).catch(error => {
        console.error('Error getting Tokens:', error);
        res.send(`Error getting Tokens: ${error}`);
    });
});



app.get('/dashboard', async (req, res) => {
    let topItems = []; // Inicializa topItems como un array vacío
    const { category, time_range } = req.query;

    try {
        // Establece el token de acceso para la API de Spotify
        if (req.session.accessToken) {
            spotifyApi.setAccessToken(req.session.accessToken);
        } else {
            throw new Error('No hay sesión iniciada');
        }

        // Intenta obtener los detalles del usuario
        const userData = await spotifyApi.getMe();
        if (!userData.body) {
            throw new Error('No se pudo obtener la información del usuario');
        }

        if (category) {
            if (category) {
                if (category === 'tracks') {
                    const topTracks = await spotifyApi.getMyTopTracks({ time_range: time_range, limit: 10 });
                    topItems = topTracks.body.items;
                } else if (category === 'artists') {
                    const topArtists = await spotifyApi.getMyTopArtists({ time_range: time_range, limit: 10 });
                    topItems = topArtists.body.items;
                } else if (category === 'genres') {
                    // Implementa la lógica para los géneros aquí
                }
            }
        }

        // Renderiza la vista del dashboard con los datos del usuario y topItems
        res.render('dashboard', { user: userData.body, topItems: topItems });
    } catch (error) {
        console.error('Error getting Dashboard Data:', error);
        // Maneja el error, por ejemplo, redirigiendo al login o mostrando un mensaje de error
        res.redirect('/login');
    }
});



// Suponiendo que ya has configurado `spotifyApi` y has manejado la autenticación del usuario.

app.get('/create-playlist', async (req, res) => {
    // Asegúrate de que el usuario esté autenticado y tengas un token de acceso
    if (!req.session.accessToken) {
        return res.redirect('/login'); // Redirige al usuario para iniciar sesión si no hay token de acceso
    }

    spotifyApi.setAccessToken(req.session.accessToken);

    try {
        const userData = await spotifyApi.getMe();
        const userId = userData.body.id; // ID del usuario

        // Definir el nombre y la descripción de la playlist
        const playlistName = "Mi Playlist Personalizada";
        const playlistDescription = "Playlist creada a través de Auto-Wrapped";

        // Crear la playlist
        const createdPlaylist = await spotifyApi.createPlaylist(userId, playlistName, {
            'description': playlistDescription,
            'public': true
        });

        // Añadir pistas a la playlist
        const trackUris = req.session.trackUris; // URIs de las pistas
        if (trackUris && trackUris.length > 0) {
            await spotifyApi.addTracksToPlaylist(createdPlaylist.body.id, trackUris);
        }

        res.redirect(createdPlaylist.body.external_urls.spotify);
    } catch (error) {
        console.error('Error al crear la playlist:', error);
        res.status(500).send('Error al crear la playlist: ' + error.message);
    }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
