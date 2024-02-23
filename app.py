import sqlite3
from flask import Flask,jsonify,render_template,request,flash,redirect,make_response,url_for,session,send_from_directory
from pymongo import MongoClient
import os 
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash,check_password_hash
from werkzeug.debug import DebuggedApplication
import uuid
from datetime import datetime
import jwt
from functools import wraps
import openai
import random
from bson.json_util import dumps
import requests
import time
from requests.exceptions import HTTPError, Timeout, RequestException
import logging
import json
import csv
from langchain.chains import LLMChain
from langchain_community.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferMemory
from trulens_eval import TruChain, Feedback, OpenAI as tOpenAI, Huggingface, Tru


load_dotenv()
app = Flask(__name__, template_folder='.')
openai.api_key = os.getenv("OPENAI_API_KEY")
app.secret_key=os.getenv("Secret_key")
app.wsgi_app = DebuggedApplication(app.wsgi_app, True)  
url=os.getenv("DATABASE_URL")
client = MongoClient(url)
hf_api_key=os.getenv('HUGGINGFACE_API_KEY')
HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5"

os.environ["OPENAI_API_KEY"] = openai.api_key
topenai = tOpenAI()
tru = Tru()

db = client.get_database("Languify")
collection = db["products"]
User_collection = db["users"]
Point_collection = db["points"]
PointsHistory_collection=db["point_history"]

class User:
    def __init__(self, username, email, password,mother_language,level=None,privilige=None,status=None,wanted_language=None):
        self.user_id = str(uuid.uuid4())
        self.username = username
        self.email = email
        self.password = generate_password_hash(password)
        self.mother_language=mother_language
        self.level = level if level else "beginner"
        self.privilage=privilige if privilige  else "User" 
        self.status=status if status else "Basic"
        self.wanted_language = wanted_language




class Points:
    def __init__(self, user_id, points,last_date):
        self.points_id = str(uuid.uuid4())
        self.user_id = user_id
        self.points = points
        self.last_date=last_date

class PointsHistory:
    def __init__(self, user_id, points_earned, date_earned):
        self.history_id = str(uuid.uuid4())
        self.user_id = user_id
        self.points_earned = points_earned
        self.date_earned = date_earned




def auth_middleware(route_handler):
    @wraps(route_handler)
    def wrapper(*args, **kwargs):
        token = request.cookies.get('token')
        if not token:
            flash('Authentication token missing', 'failure')
            return redirect('/sign_in')

        try:
            decoded_token = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            flash('Token expired', 'failure')
            return redirect('/sign_in')
        except jwt.InvalidTokenError:
            flash('you are not autherized to access that!', 'failure')
            return redirect('/sign_in')

        return route_handler(*args, **kwargs)

    return wrapper
def privilege_middleware(route_handler):
    @wraps(route_handler)
    def wrapper(*args, **kwargs):
        # Retrieve the user_id from the session
        user_id = session.get('user_id')

        # If user_id is not in session, redirect to sign-in page
        if not user_id:
            flash('User not logged in', 'failure')
            return redirect('/sign_in')

        # Assuming you have a function to retrieve the user's role based on user_id
       
        user = User_collection.find_one({'user_id': user_id})
        user_role = user.get('privilage')
        # If the user is not an admin, redirect with a flash message
        if user_role != 'admin':
            flash('You are not authorized to access this resource', 'failure')
            return redirect('/')

        # If the user is an admin, proceed to the route handler
        return route_handler(*args, **kwargs)

    return wrapper

@app.route('/signup', methods=['POST'])
def signup():
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    mother_language= request.form.get('mother_language')
    if not username or not email or not password or not mother_language:
        return jsonify({'message': 'Username, email, and password are required fields'}), 400
  
    # Check if the user already exists
    existing_user = User_collection.find_one({'email': email})
    if existing_user:
        flash('User already exists', 'failure')
        return redirect('/sign_up')
    
    new_user = User(username, email, password,mother_language)
    new_points = Points(user_id=new_user.user_id, points=0, last_date=datetime.now())
    Point_collection.insert_one(new_points.__dict__)
    User_collection.insert_one(new_user.__dict__)
    token = jwt.encode({'email': email}, app.secret_key, algorithm='HS256')
    response = make_response(redirect('/'))
    response.set_cookie('user_id', str(new_user.user_id))  
    response.set_cookie('token', token)
    flash(f'Welcome, {username}! You have successfully signed up.', 'success')

    return response
@app.route('/signin', methods=['POST'])
def signin():
    email = request.form.get('email')
    password = request.form.get('password')

    if not email or not password:
        flash('Email and password are required fields', 'failure')
        return redirect('/sign_in')

    user = User_collection.find_one({'email': email})
    if not user or not check_password_hash(user['password'], password):
        flash('Invalid email or password', 'failure')
        return redirect('/sign_in')
    
    token = jwt.encode({'email': email}, app.secret_key, algorithm='HS256')
    response = make_response(redirect('/'))
    response.set_cookie('user_id', str(user.get('user_id')))  # Set user_id as a cookie

    response.set_cookie('token', token)

    flash('Welcome back!', 'success')
    return response

@app.route('/logout')
def logout():
    response = make_response(redirect(url_for('sign_in')))
    response.set_cookie('token', expires=0)  
    response.set_cookie('user_id', expires=0)  

    return response

@app.route('/add_point', methods=['POST'])
def add_point():
    if 'user_id' not in session:
        flash('not authrized!', 'failure')
        return redirect('/sign_in')
    user_id = session['user_id']
    user = User_collection.find_one({'user_id': user_id})
    if not user:
        return jsonify({'message': 'User not found'}), 404
    user_points = user.get('points', 0)
    user_points += 1  
    User_collection.update_one({'user_id': user_id}, {'$set': {'points': user_points}})
    new_point_history = PointsHistory(user_id=user_id, points_earned=1, date_earned=datetime.now())
    PointsHistory_collection.insert_one(new_point_history.__dict__)

    return jsonify({'message': 'Point added successfully'}), 200
@app.route('/api/users/update_wanted_language/<user_id>', methods=['POST'])
def update_wanted_language(user_id):
    # Get the new wanted language from the request data
    new_wanted_language = request.json.get('wanted_language')

    # Find the user by user_id
    user = User_collection.find_one({'user_id': user_id})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Update the wanted language for the user
    User_collection.update_one({'user_id': user_id}, {'$set': {'wanted_language': new_wanted_language}})

    # Return success message
    response = make_response(jsonify({'message': 'Wanted language updated successfully', 'new_wanted_language': new_wanted_language}))
    response.set_cookie('wanted_language', value=new_wanted_language, max_age=302460*60)  # Expires in 30 days

    return response

@app.route('/')
@auth_middleware
def index():
    return render_template('front.html')

    
@app.route('/sign_in')
def sign_in():
    return render_template('sign-in.html')
@app.route('/sign_up')
def sign_up():
    return render_template('sign-up.html')
@app.route('/image')
def image():
    return render_template('image.html')
@app.route('/words')
def words():
    return render_template('words.html')
@app.route('/paragraph_tts')
def paragraph_tts():
    return render_template('paragraph_tts.html')
@app.route('/audio_words')
def audio_words():
    return render_template('audio_words.html')
@app.route('/test')
def test():
    return render_template('test.html')
@app.route('/chat')
def chat():
    return render_template('chat.html')
@app.route('/describe_img')
def describe_img():
    return render_template('describe_img.html')
@app.route('/profile')
def profile():
    return render_template('profile.html')


#generate sentence
@app.route('/generate_sentence')
def generate_sentence():
    wanted_language = request.cookies.get('wanted_language')
    if not wanted_language:
        wanted_language = 'English'
    system_language=f"RESPONDE IN {wanted_language} LANGUAGE ONLY AND KEEP THE SAME FORMAT."

    headers = {
        'Authorization': f'Bearer {openai.api_key}',
        'Content-Type': 'application/json',
    }
    data = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": system_language},
            {"role": "system", "content": "Generate a random sentence with 6 to 8 words."},
            {"role": "user", "content": "Give me a random sentence that has between 6 to 8 words. DO NOT INCLUDE ANY OTHER TEXT, GIVE ME JUST THE SENTENCE."}
        ]
    }

    try:
        response = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=data)
        if response.status_code == 200:
            response_data = response.json()
            sentence = response_data['choices'][0]['message']['content'].strip()
            words = sentence.split()
            if 6 <= len(words) <= 8:  # Ensure the sentence has between 6 to 8 words
                random.shuffle(words)  # Shuffle the words to create the game challenge
                return jsonify({'original': sentence, 'shuffled': words}), 200
            else:
                return jsonify({'error': 'Generated sentence does not meet the word count requirement.'}), 400
        else:
            return jsonify({'error': 'Failed to fetch response from OpenAI'}), response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/update_points', methods=['POST'])
def update_points():
    user_id = request.cookies.get('user_id')

    if not user_id:
        return jsonify({'error': 'User not authenticated'}), 401

    user = User_collection.find_one({'user_id': user_id})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Get the user's current level
    current_level = user.get('level')

    # Increment the user's points in the User collection.
    new_points = user.get('points', 0) + 1

    # Check if the user should transition to the advanced level and reset points
    if current_level == 'beginner' and new_points >= 50:
        new_points = 0
        # Logic to handle advanced level or difficulty increase.
        User_collection.update_one({'user_id': user_id}, {'$set': {'level': 'advanced'}})

    User_collection.update_one({'user_id': user_id}, {'$set': {'points': new_points}})

    # Update points document or create a new one
    points_document = Point_collection.find_one({'user_id': user_id})
    if points_document:
        Point_collection.update_one(
            {'user_id': user_id},
            {'$set': {'points': new_points, 'last_date': datetime.now()}}
        )
    else:
        new_points_document = {
            'user_id': user_id,
            'points': new_points,
            'last_date': datetime.now()
        }
        Point_collection.insert_one(new_points_document)

    points_history_entry = PointsHistory(user_id=user_id, points_earned=1, date_earned=datetime.now())
    PointsHistory_collection.insert_one(points_history_entry.__dict__)

    return jsonify({'message': 'Points updated successfully', 'points': new_points})

@app.route('/updatep/<user_id>', methods=['POST'])
def update_points_with_user_id(user_id):
    user = User_collection.find_one({'user_id': user_id})

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Increment the user's points in the User collection.
    new_points = user.get('points', 0) + 1
    User_collection.update_one({'user_id': user_id}, {'$set': {'points': new_points}})

    # Check if a points document already exists for this user.
    points_document = Point_collection.find_one({'user_id': user_id})
    if points_document:
        # If it exists, update the points and last updated date.
        Point_collection.update_one(
            {'user_id': user_id},
            {'$set': {'points': new_points, 'last_date': datetime.now()}}
        )
    else:
        # If no document exists, create a new one.
        new_points_document = {
            'user_id': user_id,
            'points': new_points,
            'last_date': datetime.now()
        }
        Point_collection.insert_one(new_points_document)

    points_history_entry = PointsHistory(user_id=user_id, points_earned=1, date_earned=datetime.now())
    PointsHistory_collection.insert_one(points_history_entry.__dict__)
 
    if new_points >= 50:
        # Logic to handle advanced level or difficulty increase.
        User_collection.update_one({'user_id': user_id}, {'$set': {'level': 'advanced'}})

    return jsonify({'message': 'Points updated successfully', 'points': new_points})

@app.route('/change_status', methods=['POST'])
def change_status():
    if 'user_id' not in session:
        flash('not authrized!', 'failure')
        return redirect('/sign_in')
    user_id = session['user_id']
    user = User_collection.find_one({'user_id': user_id})
    if not user:
        return jsonify({'message': 'User not found'}), 404
    User_collection.update_one({'user_id': user_id}, {'$set': {'status': 'premium'}})
    flash('Plan upgraded!', 'success')
    return jsonify({'message': 'Point added successfully'}), 200

@app.route('/api/users/<user_id>', methods=['GET'])
def get_user(user_id):
    # Perform an aggregation to join the user data with their point history
    pipeline = [
        {"$match": {"user_id": user_id}},  # Match the user by user_id
         {
        "$lookup": {
            "from": "point_history",  # The collection to join with
            "localField": "user_id",  # Field from the "users" collection
            "foreignField": "user_id",  # Field from the "points_history" collection
            "as": "point_history"  # Alias for the joined documents
        }
    },
        {
            "$lookup": {
                "from": "points",  # The collection to join with
                "localField": "user_id",  # Field from the "users" collection
                "foreignField": "user_id",  # Field from the "points" collection
                "as": "points"  # Alias for the joined documents
            }
        }
    ]

    # Execute the aggregation pipeline
    user_data = list(User_collection.aggregate(pipeline))

    # Check if the user exists
    if user_data:
        # Extract level from the user data
        level = user_data[0].get('level', 'beginner')

        # Convert the result to JSON
        user_json = dumps(user_data[0])

        # Create response with user data
        response = make_response(jsonify(user_json))

        # Set the level in a cookie
        response.set_cookie('level', value=level, max_age=302460*60)  # Expires in 30 days

        return response
    else:
        return jsonify({'message': 'User not found'}), 404
    

#chatbot code:
# Initialize a simple in-memory structure to hold conversation histories
# In a production environment, consider using a more persistent storage solution
conversations = {}


def get_conversation_history(session_id):
    return conversations.get(session_id, [])

def update_conversation_history(session_id, user_message, bot_message):
    if session_id not in conversations:
        conversations[session_id] = []
    conversations[session_id].append({"role": "user", "content": user_message})
    conversations[session_id].append({"role": "assistant", "content": bot_message})

def create_prompt_with_instructions(messages, instruction="Respond with short, engaging messages. Ask questions or suggest topics to keep the conversation going."):
    prompt_messages = [{"role": "system", "content": instruction}] + messages
    return prompt_messages

@app.route('/download-file/')
def download_file():
    directory = os.getcwd()  # Gets the current working directory
    filename = "./aggregated_feedback_and_records_data.csv"
    return send_from_directory(directory, filename, as_attachment=True)


def suggest_topic_if_new_conversation(messages):
    topics = [
        "Would you like to talk about 'technology and its impacts on society'?",
        "How about discussing 'the future of space exploration'?",
        "What are your thoughts on 'artificial intelligence and ethics'?",
        "Let's consider 'the importance of environmental conservation'.",
        "Are you interested in 'the evolution of music genres over the decades'?",
        "What do you think about 'the role of social media in modern communication'?"
    ]
    
    if not messages:  # If it's a new conversation
        default_topic_instruction = random.choice(topics)
        messages.insert(0, {"role": "system", "content": default_topic_instruction})
    return messages
#######
template = """You are a chatbot having a conversation with a human.Respond with short, engaging messages. Ask questions or suggest topics to keep the conversation going.
        {chat_history}
        Human: {human_input}
        Chatbot:"""
prompt_template = PromptTemplate(
    input_variables=["chat_history", "human_input"], template=template
    )
memory = ConversationBufferMemory(memory_key="chat_history")
llm = ChatOpenAI(model_name="gpt-3.5-turbo")
chain = LLMChain(llm=llm, prompt=prompt_template, memory=memory, verbose=True)

f_relevance = Feedback(topenai.relevance).on_input_output()
f_qs_relevance = Feedback(topenai.qs_relevance).on_input_output()
f_hate = Feedback(topenai.moderation_hate).on_output()
f_violent = Feedback(topenai.moderation_violence, higher_is_better=False).on_output()
f_selfharm = Feedback(topenai.moderation_selfharm, higher_is_better=False).on_output()
f_maliciousness = Feedback(topenai.maliciousness_with_cot_reasons, higher_is_better=False).on_output()
f_coherence = Feedback(topenai.coherence, higher_is_better=True).on_output()
f_generate_score = Feedback(topenai.generate_score).on_output()
f_helpfulness = Feedback(topenai.helpfulness,higher_is_better=True).on_output()
f_moderation_harassment = Feedback(topenai.moderation_harassment,higher_is_better=False).on_output()

chain_recorder = TruChain(
    chain, app_id="LinguaSync-AI", feedbacks=[f_generate_score,f_relevance,f_qs_relevance,f_hate,f_violent,f_selfharm,f_maliciousness,f_coherence,f_helpfulness,f_moderation_harassment]
    )

messages_test = []
def record_conversation_and_feedback(messages):
    filename = "conversation_eval.csv"
    with open(filename, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(["Role", "Content", "Feedback"])
        for message in messages:
            content = message["content"]
            role = message["role"]
            feedback = message.get("feedback", {})
            feedback_str = json.dumps(feedback, ensure_ascii=False, default=str) if feedback else ""
            writer.writerow([role, content, feedback_str])
            print(feedback_str)

def export_aggregated_feedback_to_csv(db_filepath, csv_filepath):
    conn = sqlite3.connect(db_filepath)
    cursor = conn.cursor()

    # Fetch all records
    cursor.execute("SELECT record_id, input, output FROM records")
    records = cursor.fetchall()
    
    # Fetch all feedback
    cursor.execute("SELECT record_id, name, result FROM feedbacks")
    feedbacks = cursor.fetchall()
    
    # Map feedback to records
    record_feedback = {row[0]: {'input': row[1], 'output': row[2], 'feedback': []} for row in records}
    for feedback in feedbacks:
        if feedback[0] in record_feedback:
            record_feedback[feedback[0]]['feedback'].append(f"{feedback[1]}: {feedback[2]}")

    # Write to CSV file
    with open(csv_filepath, 'w', newline='', encoding='utf-8') as file:
        csv_writer = csv.writer(file)
        csv_writer.writerow(['Record ID', 'Input', 'Output', 'Feedback (Name: Result)'])
        for record_id, record_info in record_feedback.items():
            feedback_str = "; ".join(record_info['feedback']) if record_info['feedback'] else "No feedback"
            csv_writer.writerow([record_id, record_info['input'], record_info['output'], feedback_str])

    conn.close()

db_filepath = 'default.sqlite'
csv_filepath = 'aggregated_feedback_and_records_data.csv'


@app.route('/ask', methods=['POST'])
def ask():
    data = request.json
    session_id = data.get('session_id')
    user_message = data['message']

    conversation_history = get_conversation_history(session_id)
    conversation_history.append({"role": "user", "content": user_message})

    try:
        with chain_recorder as recording:
            full_response = chain.run(user_message)
            feedback = {}
            
    except AttributeError as e:
        print(f"Error retrieving feedback: {e}")
        feedback = {}  # Fallback to empty feedback if there's an issue
    tru.get_records_and_feedback(app_ids=[])[0]

    conversation_history.append({"role": "assistant", "content": full_response, "feedback": feedback})
    update_conversation_history(session_id, user_message, full_response)
    record_conversation_and_feedback(conversation_history)  # Pass a list with the last message
    export_aggregated_feedback_to_csv(db_filepath, csv_filepath)
    return jsonify({'response': full_response.strip()}), 200

#generate image with words
def query_image_generation(prompt, retry_limit=3, timeout=10):
    hf_headers = {"Authorization": f"Bearer {hf_api_key}"}
    data = {"inputs": prompt}
    for attempt in range(retry_limit):
        try:
            response = requests.post(HUGGINGFACE_API_URL, headers=hf_headers, json=data, timeout=timeout)
            response.raise_for_status()
            return response.content
        except Timeout:
            logging.warning('The request timed out, attempting retry...')
        except HTTPError as http_err:
            if response.status_code == 503 and attempt < retry_limit - 1:
                logging.warning('Service unavailable, retrying...')
            else:
                logging.error(f'HTTP error occurred: {http_err}')
                break
        except RequestException as req_err:
            logging.error(f'Request error occurred: {req_err}')
            break
        time.sleep((2 ** attempt) * 3)
    return None

@app.route('/generate_image_with_random_word')
def generate_image_with_random_word():
    wanted_language = request.cookies.get('wanted_language')
    if not wanted_language:
        wanted_language = 'English'
    system_language=f"RESPONDE IN {wanted_language} LANGUAGE ONLY AND KEEP THE SAME FORMAT."
    headers = {
        'Authorization': f'Bearer {openai.api_key}',
        'Content-Type': 'application/json',
    }
    data = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": system_language},
            {"role": "system", "content": "Generate 4 random words that can be visually represented. DO NOT INCLUDE ANY ADDITIONAL CHARACTERS OR SYMBOLS. DO NOT ENUMERATE THE WORDS. MAKE SURE TO ALWAYS GIVE THE WORDS IN THIS FORMAT: 'word1\nword2\nword3\nword4'."}
        ]
    }
    try:
        response = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=data)
        response.raise_for_status()
        words = response.json()['choices'][0]['message']['content'].strip().split("\n")
        object_name = random.choice(words)
        prompt = f"Generate an image of {object_name}"
        image_data = query_image_generation(prompt)
        if image_data:
            file_path = './static/img/generated_image.png'
            with open(file_path, 'wb') as f:
                f.write(image_data)
            return jsonify({'message': 'Image generated successfully', 'words': words, 'correct_word': object_name})
        else:
            return jsonify({'message': 'Failed to generate image'})
    except Exception as e:
        logging.error(f'Error occurred: {e}')
        return jsonify({'message': 'Failed to generate image. Internal server error.'})

@app.route('/generate_words_for_tts')
def generate_words_for_tts():
    wanted_language = request.cookies.get('wanted_language')
    if not wanted_language:
        wanted_language = 'English'
    system_language=f"RESPONDE IN {wanted_language} LANGUAGE ONLY AND KEEP THE SAME FORMAT."
    headers = {
        'Authorization': f'Bearer {openai.api_key}',
        'Content-Type': 'application/json',
    }
    data = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": system_language},
            {"role": "system", "content": "Generate 4 random words that are close in pronunciation but not too much. DO NOT INCLUDE ANY ADDITIONAL CHARACTERS OR SYMBOLS. DO NOT ENUMERATE THE WORDS. MAKE SURE TO ALWAYS GIVE THE WORDS IN THIS FORMAT: 'word1\nword2\nword3\nword4'."}
        ]
    }
    try:
        response = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=data)
        response.raise_for_status()  
        words = response.json()['choices'][0]['message']['content'].strip().split("\n")
        correct_word = random.choice(words)
        return jsonify({'words': words, 'correct_word': correct_word})
    except Exception as e:
        logging.error(f'Error occurred: {e}')
        return jsonify({'error': str(e)}), 500
    

    
@app.route('/generate_paragraph_for_tts')
def generate_paragraph_for_tts():
    wanted_language = request.cookies.get('wanted_language')
    if not wanted_language:
        wanted_language = 'English'
    system_language=f"RESPONDE IN {wanted_language} LANGUAGE ONLY AND KEEP THE SAME FORMAT."
    headers = {
        'Authorization': f'Bearer {openai.api_key}',
        'Content-Type': 'application/json',
    }
    data = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": system_language},
            {"role": "system", "content": "Generate a random sentence suitable for language learning. The sentence should be easy to understand and pronounce for English speakers. DO NOT INCLUDE ANY ADDITIONAL CHARACTERS OR SYMBOLS like '.', ',', '?', etc."}
        ]
    }
    try:
        response = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=data)
        response.raise_for_status() 
        paragraph = response.json()['choices'][0]['message']['content'].strip()
        return jsonify({'paragraph': paragraph})
    except Exception as e:
        logging.error(f'Error occurred: {e}')
        return jsonify({'error': str(e)}), 500
    

#for quiz "test"
@app.route('/expand_on_topic', methods=['POST'])
def expand_on_topic():
    headers = {
        'Authorization': f'Bearer {openai.api_key}',
        'Content-Type': 'application/json',
    }
    prompt = request.json.get('prompt')
    wanted_language = request.cookies.get('wanted_language')
    if not wanted_language:
        wanted_language = 'English'
    
    level = request.cookies.get('level')
    system_message = f"Given a topic provided by the user in {wanted_language}, with a language proficiency level of {level}, expand on it with insightful information."
    system_message_2=f"RESPONDE IN {wanted_language} LANGUAGE ONLY AND KEEP THE SAME FORMAT."
    data = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "system", "content": system_message_2},
            {"role": "user", "content": prompt}
        ]
    }
    try:
        response = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=data)
        response.raise_for_status()
        sentence = response.json()['choices'][0]['message']['content'].strip()
        return jsonify({'original': sentence})
    except Exception as e:
        logging.error(f'Error occurred: {e}')
        return jsonify({'error': str(e)}), 500
    
@app.route('/generate_multiple_choice_questions', methods=['POST'])
def generate_multiple_choice_questions():
    headers = {
        'Authorization': f'Bearer {openai.api_key}',
        'Content-Type': 'application/json',
    }
    wanted_language = request.cookies.get('wanted_language')
    if not wanted_language:
        wanted_language = 'English'
    
    topic = request.json.get('topic')
    system_language=f"RESPONDE IN {wanted_language} LANGUAGE ONLY AND KEEP THE SAME FORMAT."
    data = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": system_language},
            {"role": "system", "content": f"Generate 4 multiple-choice questions based on the text: {topic}."}
        ]
    }
    try:
        response = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=data)
        response.raise_for_status()  # Check for HTTP request errors
        
        # The response data should directly give you the text containing questions
        questions_untreated = response.json()['choices'][0]['message']['content'].strip()
        
        # Since the questions are expected to be formatted as a single string with questions split by two newlines, we don't need further processing
        questions = questions_untreated.split('\n\n')  # Splitting by two newlines to separate each question

        return jsonify({'questions': questions})

    except Exception as e:
        logging.error(f'Error occurred: {e}')
        return jsonify({'error': str(e)}), 500
    
def generate_prompt(selected_options):
    # yarja3 bel anglais
    wanted_language = request.cookies.get('wanted_language')
    if not wanted_language:
        wanted_language = 'English'
    prompt = f"Language: {wanted_language}\n\n"
    prompt += "Given the provided questions, create a JSON object which enumerates a set of 4 child objects. Each child object has a property named 'question', a property named 'answer', and a property named 'user_answer'. For each child object, assign to the property named 'question' a question provided, to the property named 'answer' the correct answer to the question, and to the property named 'user_answer' allocate the answer provided from the user. The resulting JSON object should be in this format: [{'question':'string','answer':'string'}].\n\n"
    
    for idx, option in enumerate(selected_options, start=1):
        question = option['question']
        selected_option_index = option['selectedOptionIndex']
        options = option['options']
        
        prompt += f"{idx}. {question}\n"
        for i, opt in enumerate(options):
            if i == selected_option_index:
                prompt += f"[{chr(ord('A') + i)}] {opt} (User's Choice)\n"
            else:
                prompt += f"[{chr(ord('A') + i)}] {opt}\n"
    return prompt

@app.route('/submit_test', methods=['POST'])
def submit_test():
    selected_options = request.json.get('selectedOptions', [])
    prompt = generate_prompt(selected_options)  
    wanted_language = request.cookies.get('wanted_language')
    if not wanted_language:
        wanted_language = 'English'
    system_language=f"RESPONDE IN {wanted_language} LANGUAGE ONLY AND KEEP THE SAME FORMAT."
    headers = {
        'Authorization': f'Bearer {openai.api_key}',
        'Content-Type': 'application/json',
    }
    data = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": system_language},
            {"role": "system", "content": prompt}
        ]
    }
    try:
        response = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=data)
        response.raise_for_status() 
        evaluation_result = response.json()['choices'][0]['message']['content'].strip()
        evaluation_result = evaluation_result.strip('```json').strip('```').strip()
        return jsonify({'message': 'Test submitted successfully', 'evaluation_result': evaluation_result}), 200
    except Exception as e:
        logging.error(f'Error occurred: {e}')
        return jsonify({'error': str(e)}), 500
    
#describe image from url
@app.route('/analyze-image-url', methods=['POST'])
def analyze_image_url():
    wanted_language = request.cookies.get('wanted_language')
    if not wanted_language:
        wanted_language = 'English'
    data = request.get_json()
    image_url = data.get('image_url')
    
    if not image_url:
        return jsonify({'error': 'No image URL provided'}), 400

    headers = {
        'Authorization': f'Bearer {openai.api_key}',
        'Content-Type': 'application/json',
    }
    data ={
        "model": "gpt-4-vision-preview",
        "messages": [
            {
            "role": "user",
            "content": [
                {"type": "text", "text": f"Describe this image briefely in {wanted_language} language."},
                {
                "type": "image_url",
                "image_url": {
                    "url": image_url,
                },
                },
            ],
            }
        ],
        "max_tokens" : 300
    }
    try:
        response = requests.post('https://api.openai.com/v1/chat/completions', headers=headers, json=data)
        if response.ok:
            response_data = response.json()
            description = response_data['choices'][0]['message']['content']
            return jsonify({'description': description})
        else:
            return jsonify({'error': 'Failed to fetch response from OpenAI', 'status_code': response.status_code})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
   
#tts1 openai
@app.route('/tts_for_word', methods=['POST'])
def tts_for_word():
    data = request.json
    tts_input = data['correct_word'] if 'correct_word' in data else ''
    response = openai.OpenAI().audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=tts_input,
    )
    response.stream_to_file("./static/audio/ttsword.mp3")
    return jsonify({"message": "TTS created successfully."})

@app.route('/tts_for_parag', methods=['POST'])
def tts_for_parag():
    data = request.json
    tts_input = data['paragraph'] if 'paragraph' in data else ''
    response = openai.OpenAI().audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=tts_input,
    )
    response.stream_to_file("./static/audio/ttsparag.mp3")
    return jsonify({"message": "TTS created successfully."})

if __name__ == '__main__':
    app.run(debug=True)