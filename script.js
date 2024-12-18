// script.js

// Get the start button, status display, and microphone indicator elements
const startButton = document.getElementById('startButton');
const statusDisplay = document.getElementById('status');
const microphoneIndicator = document.getElementById('microphoneIndicator');

// Variables to store audio context, analyser, and other related data
let audioContext;
let analyser;
let microphone;
let bufferLength;
let dataArray;
let bpm = 0;
let lastBeatTime = 0;
let beatTimes = [];
let isListening = false;
let isFixedBPM = false;
let oscillator;
let gainNode;

// Function to initialize the audio context and analyser
async function initAudio() {
    try {
        // Create a new audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Create an analyser node for frequency analysis
        analyser = audioContext.createAnalyser();
        // Set the FFT size for the analyser (determines the frequency resolution)
        analyser.fftSize = 2048;
        // Get the buffer length from the analyser
        bufferLength = analyser.frequencyBinCount;
        // Create a new array to store the frequency data
        dataArray = new Uint8Array(bufferLength);

        // Get access to the user's microphone
        microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Create a media stream source node from the microphone input
        const source = audioContext.createMediaStreamSource(microphone);
        // Connect the microphone source to the analyser node
        source.connect(analyser);

        // Set the initial status message
        statusDisplay.textContent = 'Ready to listen';
        console.log('Audio initialized');
    } catch (error) {
        // Log any errors that occur during initialization
        console.error('Error initializing audio:', error);
        statusDisplay.textContent = 'Error initializing audio. Please check console.';
    }
}


// Function to analyze the audio data and detect BPM
function analyzeAudio() {
    // Request animation frame for smooth audio analysis
    requestAnimationFrame(analyzeAudio);

    if (!isListening || isFixedBPM) return;

    // Get the frequency data from the analyser
    analyser.getByteFrequencyData(dataArray);

    // Calculate the average volume of the audio
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
    }
    const averageVolume = sum / bufferLength;

    // If the average volume is above a certain threshold, consider it a beat
    if (averageVolume > 60) {
        // Get the current time in seconds
        const currentTime = audioContext.currentTime;
        // Calculate the time difference since the last beat
        const timeSinceLastBeat = currentTime - lastBeatTime;

        // If a beat was detected, update the beat times array
        if (timeSinceLastBeat > 0.1) {
            beatTimes.push(timeSinceLastBeat);
            lastBeatTime = currentTime;
            console.log('Beat detected', { timeSinceLastBeat });
        }

        // If we have enough beat times, calculate the average BPM
        if (beatTimes.length > 2) {
            // Calculate the average time between beats
            const averageBeatTime = beatTimes.reduce((a, b) => a + b, 0) / beatTimes.length;
            // Calculate the BPM from the average beat time
            const currentBPM = 60 / averageBeatTime;

            // If the BPM is within a reasonable range, update the BPM
            if (currentBPM > 30 && currentBPM < 200) {
                bpm = currentBPM;
                statusDisplay.textContent = `Detected BPM: ${bpm.toFixed(2)}`;
                console.log('BPM updated', { bpm });
            }

            // Check if the BPM is stable
            if (beatTimes.length > 4) {
                const lastFourBeats = beatTimes.slice(-4);
                const averageLastFourBeats = lastFourBeats.reduce((a, b) => a + b, 0) / lastFourBeats.length;
                const lastFourBPM = 60 / averageLastFourBeats;
                const bpmDifference = Math.abs(lastFourBPM - bpm);
                const bpmPercentageDifference = (bpmDifference / bpm) * 100;

                // If the BPM is stable within a 10% range, fix the BPM
                if (bpmPercentageDifference <= 10) {
                    isFixedBPM = true;
                    statusDisplay.textContent = `BPM Fixed: ${bpm.toFixed(2)}`;
                    console.log('BPM fixed', { bpm });
                    playDrumBeat();
                }
            }
        }
    } else if (beatTimes.length > 0) {
        // If the user stops playing, reset the BPM and beat times
        beatTimes = [];
        bpm = 0;
        isFixedBPM = false;
        statusDisplay.textContent = 'Listening for BPM';
        console.log('Stopped playing, resetting BPM');
        stopDrumBeat();
    }
}

// Function to play the drum beat using an oscillator
function playDrumBeat() {
    if (!isFixedBPM) return;

    // Calculate the time interval between beats based on the fixed BPM
    const beatInterval = 60 / bpm;
    let startTime = audioContext.currentTime;

    // Function to schedule the next beat
    function scheduleBeat() {
        // Create a new oscillator node
        oscillator = audioContext.createOscillator();
        // Set the oscillator type to square wave
        oscillator.type = 'square';
        // Set the oscillator frequency
        oscillator.frequency.value = 440;
        // Create a gain node to control the volume
        gainNode = audioContext.createGain();
        // Connect the oscillator to the gain node
        oscillator.connect(gainNode);
        // Connect the gain node to the audio context destination
        gainNode.connect(audioContext.destination);

        // Set the volume of the oscillator
        gainNode.gain.value = 0.2;

        // Apply a fade-in effect to the first beat
        if (audioContext.currentTime - startTime < 0.5) {
            gainNode.gain.value = (audioContext.currentTime - startTime) * 0.4;
        }

        // Apply an accent to the first beat of each measure
        const beatInMeasure = Math.round((audioContext.currentTime - startTime) / beatInterval) % 4;
        if (beatInMeasure === 0) {
            gainNode.gain.value = 0.4;
        }

        // Start the oscillator at the scheduled time
        oscillator.start(startTime);
        // Stop the oscillator after a short duration
        oscillator.stop(startTime + 0.1);
        console.log('Playing beat', { startTime });

        // Schedule the next beat
        startTime += beatInterval;
        if (isFixedBPM) {
            setTimeout(scheduleBeat, (beatInterval * 1000) - 10); // Schedule next beat with a slight offset to avoid drift
        }
    }

    // Start scheduling the drum beats
    scheduleBeat();
}

// Function to stop the drum beat
function stopDrumBeat() {
    if (oscillator) {
        oscillator.stop();
        oscillator.disconnect();
        oscillator = null;
    }
    if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
    }
    console.log('Stopped drum beat');
}

// Event listener for the start button
startButton.addEventListener('click', async () => {
    if (!isListening) {
        // Initialize the audio context and analyser
        await initAudio();
        // Start analyzing the audio
        analyzeAudio();
        // Set the listening flag to true
        isListening = true;
        // Update the button text
        startButton.textContent = 'Stop Listening';
        statusDisplay.textContent = 'Listening for BPM';
        microphoneIndicator.classList.add('active');
        console.log('Started listening');
    } else {
        // Stop listening and reset the state
        isListening = false;
        isFixedBPM = false;
        beatTimes = [];
        bpm = 0;
        stopDrumBeat();
        // Update the button text
        startButton.textContent = 'Start Listening';
        statusDisplay.textContent = 'Stopped listening';
        microphoneIndicator.classList.remove('active');
        console.log('Stopped listening');
    }
});
