// Function to expand on the topic
let generatedPrompt = '';

async function expandOnTopic(prompt) {
    try {
        // Show loading indicator
        const generatedCodeSection = document.getElementById('generatedCode');
        generatedCodeSection.innerHTML = '<div class="loader"></div>';
        
        const response = await fetch(`/expand_on_topic`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt: prompt })
        });
        const data = await response.json();
        generatedPrompt=data.original;
        return data.original;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

// Event listener for button click

const submitBtn = document.getElementById('submitBtn');
submitBtn.addEventListener('click', async () => {
    const inputField = document.getElementById('topic');
    const userPrompt = inputField.value;
    
    // Call the function to expand on the topic
    const generatedSentence = await expandOnTopic(userPrompt);
    
    // Display the generated sentence with typing effect
    const generatedCodeSection = document.getElementById('generatedCode');
    generatedCodeSection.innerHTML = '<h2>Your Generated Topic!</h2>';
    for (let i = 0; i < generatedSentence.length; i++) {
        // Add each character with a delay to simulate typing effect
        setTimeout(() => {
            generatedCodeSection.innerHTML += generatedSentence[i];
            // Update the height of the card dynamically
            generatedCodeSection.style.height = `${generatedCodeSection.scrollHeight}px`;
        }, i * 30); // Adjust the typing speed here (50 milliseconds in this case)
    }
    generatedCodeSection.style.padding = '30px';
    const generateTestBtn = document.getElementById('generateTestBtn');
    generateTestBtn.style.visibility = 'visible';

});
async function generateTest() {
    try {
        const response = await fetch('/generate_multiple_choice_questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ topic: generatedPrompt })
        });

        const data = await response.json();
        console.log(data);

        // Directly use the questions array from the response
        const questions = data.questions;
        
        // Display the generated questions with checkboxes
        const generatedCodeSection = document.getElementById('questions');
        generatedCodeSection.innerHTML = '<h2>Generated Questions</h2>';

        // Limit to a maximum of 5 questions (though your API seems to always return 4)
        const maxQuestions = Math.min(questions.length, 5);

        // Iterate over questions up to the maximum limit
        for (let index = 0; index < maxQuestions; index++) {
            const fullQuestion = questions[index]; // Each question is already an individual string
            const parts = fullQuestion.split('\n').filter(part => part.trim() !== ''); // Split by newline and remove empty lines
            const questionText = parts.shift(); // Remove and store the question text
            generatedCodeSection.innerHTML += `
                <div class="form-group">
                    <label for="question-${index}">${questionText}</label><br>
                    ${parts.map((opt, optIndex) => `
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="question-${index}" id="radio-${index}-${optIndex}" value="${optIndex}">
                        <label class="form-check-label" for="radio-${index}-${optIndex}">${opt}</label>
                    </div>
                    `).join('')}
                </div>
            `;
        }
        const submitButton = document.getElementById('submitTest');
        submitButton.style.visibility = 'visible';
        submitButton.addEventListener('click', submitTest); 

    } catch (error) {
        console.error('Error:', error);
    }
}

async function submitTest() {
    const selectedOptions = [];
    const resultContainer = document.getElementById('result_container');
    const loadingSpinner = document.createElement('div');
    loadingSpinner.classList.add('loader');
    resultContainer.querySelector('.card-body').appendChild(loadingSpinner);
    resultContainer.style.visibility = 'hidden';

    for (let index = 0; index < 4; index++) {
        const questionText = document.querySelector(`label[for="question-${index}"]`).textContent;
        const options = [];
        const selectedOption = document.querySelector(`input[name="question-${index}"]:checked`);
        const selectedOptionIndex = selectedOption ? parseInt(selectedOption.value) : -1;

        for (let optIndex = 0; optIndex < 4; optIndex++) {
            const optionText = document.querySelector(`label[for="radio-${index}-${optIndex}"]`).textContent.trim();
            options.push(optionText);
        }

        selectedOptions.push({
            question: questionText,
            options: options,
            selectedOptionIndex: selectedOptionIndex
        });
    }

    try {
        const response = await fetch('/submit_test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ selectedOptions: selectedOptions })
        });
        loadingSpinner.remove();
        resultContainer.style.visibility = 'visible';
        const responseData = await response.json();

        if (responseData.error) {
            console.error('Error:', responseData.error);
            return;
        }

        const tryButton = document.getElementById('tryBtn');
        tryButton.style.display = 'block';

        const evaluationResultDiv = document.getElementById('evaluationResult');
        evaluationResultDiv.innerHTML = '';
        const evaluationResults = JSON.parse(responseData.evaluation_result);
        evaluationResults.forEach(result => {
            const p = document.createElement('p');
            
            // Trim and compare answers in a case-insensitive manner
            const isCorrect = result.answer.trim().toLowerCase() === result.user_answer.trim().toLowerCase();

            const icon = document.createElement('img');
            icon.src = isCorrect ? './static/img/checked.png' : './static/img/cancel.png';
            icon.alt = isCorrect ? 'Correct' : 'Incorrect';
            icon.classList.add('icon');

            const userAnswerSpan = document.createElement('span');
            userAnswerSpan.textContent = `Your Answer: ${result.user_answer}`;
            userAnswerSpan.style.color = isCorrect ? 'green' : 'red';

            p.appendChild(icon);
            p.appendChild(document.createTextNode(' '));
            p.appendChild(userAnswerSpan);
            // Use innerText to safely append text without interpreting it as HTML
            p.appendChild(document.createElement('br'));
            const questionText = document.createTextNode(`Question: ${result.question}`);
            p.appendChild(questionText);
            p.appendChild(document.createElement('br'));
            const correctAnswerText = document.createTextNode(`Correct Answer: ${result.answer}`);
            p.appendChild(correctAnswerText);

            evaluationResultDiv.appendChild(p);
        });
    } catch (error) {
        console.error('Error submitting test:', error);
    }
}

// Event listener for the "Supply me with a test" button
const generateTestBtn = document.getElementById('generateTestBtn');
generateTestBtn.addEventListener('click', generateTest);

const tryButton = document.getElementById('tryBtn');
tryButton.addEventListener('click', () => {
    window.location.reload();
});