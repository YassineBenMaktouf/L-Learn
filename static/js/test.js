// Function to expand on the topic
let generatedPrompt = '';

async function expandOnTopic(prompt) {
    try {
        // Show loading indicator
        const generatedCodeSection = document.getElementById('generatedCode');
        generatedCodeSection.innerHTML = '<div class="loader"></div>';
        
        const response = await fetch(`http://127.0.0.1:5000/expand_on_topic`, {
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
        const response = await fetch('http://127.0.0.1:5000/generate_multiple_choice_questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ topic: generatedPrompt })
        });

        const data = await response.json();
        console.log(data);

        // Select the first element of the questions array
        const questionsSet = data.questions[0];
        
        // Display the generated questions with checkboxes
        const generatedCodeSection = document.getElementById('questions');
        generatedCodeSection.innerHTML = '<h2>Generated Questions</h2>';

        // Split the questionsSet into individual questions
        const questions = questionsSet.split('\n\n');

        // Limit to a maximum of 5 questions
        const maxQuestions = Math.min(questions.length, 5);

        // Iterate over questions up to the maximum limit
        for (let index = 0; index < maxQuestions; index++) {
            const question = questions[index];
            const options = question.split('\n').filter(option => option.trim() !== ''); // Split by newline and remove empty lines
            const questionText = options.shift(); // Remove and store the question text
            generatedCodeSection.innerHTML += `
                <div class="form-group">
                    <label for="question-${index}">${index + 1}) ${questionText}</label><br>
                    ${options.slice(0, 4).map((opt, optIndex) => `
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
    resultContainer.style.visibility = 'hidden'; // Hide the result container initially
    
    // Loop through each question and get the selected option
    for (let index = 0; index < 4; index++) {
        const questText = document.querySelector(`label[for="question-${index}"]`).textContent;
        console.log(questText);
        const questionText = document.querySelector(`label[for="question-${index}"]`).textContent;
        const options = [];
        const selectedOption = document.querySelector(`input[name="question-${index}"]:checked`);
        const selectedOptionIndex = selectedOption ? parseInt(selectedOption.value) : -1;

        // Get all options for the question
        for (let optIndex = 0; optIndex < 4; optIndex++) {
            const optionText = document.querySelector(`label[for="radio-${index}-${optIndex}"]`).textContent.trim();
            options.push(optionText);
        }

        // Include the question, options, and selected option index in the response
        selectedOptions.push({
            question: questionText,
            options: options,
            selectedOptionIndex: selectedOptionIndex
        });
    }

    console.log(selectedOptions);

    // Send selected options to backend
    try {
        const response = await fetch('http://127.0.0.1:5000/submit_test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ selectedOptions })
        });
        loadingSpinner.remove();
        resultContainer.style.visibility = 'visible';
        const responseData = await response.json();
        console.log(responseData);

        const tryButton = document.getElementById('tryBtn');
        tryButton.style.display = 'block';
        
        // Display evaluation result in the evaluationResult div
        const evaluationResultDiv = document.getElementById('evaluationResult');
        if (evaluationResultDiv) {
            // Clear previous content
            evaluationResultDiv.innerHTML = '';

            // Create and append new elements for each evaluation result
            responseData.evaluation_result.forEach(result => {
                const p = document.createElement('p');
                const isCorrect = result.answer === result.user_answer;
        
                // Create img elements for icons
                const icon = document.createElement('img');
                icon.src = isCorrect ? './static/img/checked.png' : './static/img/cancel.png';
                icon.alt = isCorrect ? 'Correct' : 'Incorrect';
        
                // Create span element for user's answer
                const userAnswerSpan = document.createElement('span');
                userAnswerSpan.textContent = `Your Answer: ${result.user_answer}`;
                userAnswerSpan.style.color = isCorrect ? 'green' : 'red';
                icon.classList.add('icon'); // Add a class to the image for styling

                // Append icons and user's answer to paragraph element
                p.appendChild(icon);
                p.appendChild(document.createTextNode(' ')); // Add space between icon and user's answer
                p.appendChild(userAnswerSpan);
        
                // Append question and correct answer to paragraph element
                p.innerHTML += `<br>Question: ${result.question}<br>Correct Answer: ${result.answer}`;
        
                // Append the paragraph element to the evaluation result div
                evaluationResultDiv.appendChild(p);
            });
            
        } else {
            console.error('EvaluationResult div not found');
        }
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