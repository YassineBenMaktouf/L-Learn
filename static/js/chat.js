// Function to generate a UUID v4
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Generate a new session ID on page load
let sessionID = uuidv4();

async function sendMessage() {
    const inputField = document.getElementById('userInput');
    const userText = inputField.value;
    inputField.value = '';
    displayMessage(userText, 'user');

    const response = await fetch('/ask', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionID, message: userText}),
    });

    const data = await response.json();
    displayMessage(data.response, 'bot');
}

function displayMessage(message, sender) {
    const chatbox = document.getElementById('chatbox');
    const msgDiv = document.createElement('div');
    msgDiv.textContent = `${sender.toUpperCase()}: ${message}`;
    msgDiv.className="form-control mb-3"
    chatbox.appendChild(msgDiv);
}

window.onload = function() {
    document.getElementById('chatbox').innerHTML = '';
};