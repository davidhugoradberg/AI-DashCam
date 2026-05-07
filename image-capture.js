const { exec } = require('child_process');
const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');

// === Konfiguration — ÄNDRA DESSA TVÅ RADER ===
const PROJECT_ID = 'ditt-projekt-id';   // hittas högst upp i Google Cloud Console
const LOCATION = 'us-central1';         // eller 'europe-west4' för EU
// =============================================

const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const model = vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

var takeStill = function () {
    var child = exec('libcamera-jpeg -n -o ./images/realtime.jpg --shutter 5000000 --gain 0.5 --width 700 --height 500');

    child.stdout.on('data', function (data) {
        console.log('child process: ' + data);
    });

    child.on('exit', function (code, signal) {
        console.log('Image Capture   ' + Date.now());

        async function readPlate() {
            try {
                // Läs in bilden som base64
                const imageBytes = fs.readFileSync('./images/realtime.jpg').toString('base64');

                // Skicka till Gemini via Vertex AI
                const result = await model.generateContent({
                    contents: [{
                        role: 'user',
                        parts: [
                            { text: 'Read the license plate from the car in this image. Reply with ONLY the plate number, nothing else. If no plate is visible, reply with the word: NONE' },
                            { inlineData: { mimeType: 'image/jpeg', data: imageBytes } }
                        ]
                    }]
                });

                let license_number = result.response.candidates[0].content.parts[0].text.trim();
                console.log('Detected:', license_number);

                let html = '';
                if (!license_number || license_number.toUpperCase() === 'NONE') {
                    html = 'None Detected';
                } else {
                    // Dela upp på radbrytningar (om Gemini svarar med flera plåtar)
                    const lines = license_number.split(/\n|\r|\t/g);
                    for (let i = 0; i < lines.length; i++) {
                        console.log(lines[i]);
                        html += lines[i] + '<br/>';
                    }
                }

                // Uppdatera HTML-filen
                const data = fs.readFileSync('./html/index.html', 'utf-8');
                const newValue = data.replace(/class="license">.*?<\/h3>/gi, 'class="license">' + html + '</h3>');
                fs.writeFileSync('./html/index.html', newValue, 'utf-8');

                console.log('HTML updated');
            } catch (err) {
                console.error('Vertex AI error:', err.message);
            }

            // Ta nästa bild
            takeStill();
        }

        readPlate();
    });
}

takeStill();





