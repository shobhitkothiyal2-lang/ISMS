
import mysql.connector

def create_database():
    try:
        # Try connecting with default 'root' password
        mydb = mysql.connector.connect(
            host="localhost",
            user="root",
            password="2003"
        )
        cursor = mydb.cursor()
        cursor.execute("CREATE DATABASE IF NOT EXISTS isms_db")
        print("Database 'isms_db' created successfully!")
    except mysql.connector.Error as err:
        print(f"Error: {err}")
        print("\nCould not connect with password 'root'.")
        print("Please update the password in this script and in backend/app.py")

if __name__ == "__main__":
    create_database()
