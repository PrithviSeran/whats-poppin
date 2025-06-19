#!/usr/bin/env python3
"""
Setup script for automated daily training of BeaconAI models
This script helps you set up cron jobs for daily model training
"""

import os
import sys
import subprocess
from pathlib import Path

def create_training_script():
    """Create the daily training script that will be run by cron"""
    
    script_content = '''#!/usr/bin/env python3
"""
Daily training script for BeaconAI - called by cron job
"""

import sys
import os
import logging
from datetime import datetime

# Add your project path to Python path
sys.path.append('/path/to/your/project')  # UPDATE THIS PATH

# Set up logging
log_file = '/path/to/your/logs/beacon_daily_training.log'  # UPDATE THIS PATH
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def main():
    """Main training function"""
    try:
        logger.info("🏋️ Starting daily BeaconAI training job")
        
        # Import your modules
        from beacon_torch_persistent import PersistentBeaconAI
        from your_data_loader import load_training_data  # UPDATE THIS IMPORT
        
        # Initialize BeaconAI
        beacon = PersistentBeaconAI(
            embedding_dim=32,
            use_bias=True,
            device='cuda',  # Use 'cpu' if no GPU
            model_cache_dir="/path/to/your/models",  # UPDATE THIS PATH
            user_id=None  # Global model, set to user_id for user-specific models
        )
        
        # Load training data
        logger.info("📊 Loading training data...")
        users, events, user_features, event_features, interactions = load_training_data()
        logger.info(f"Data loaded: {len(users)} users, {len(events)} events, {len(interactions)} interactions")
        
        # Train or load model
        result = beacon.load_or_train(
            users, events, user_features, event_features, interactions,
            force_retrain=False,
            epochs=15,
            learning_rate=0.01,
            batch_size=512,
            use_early_stopping=True,
            patience=5
        )
        
        if result == "trained":
            logger.info("✅ Model trained successfully")
        else:
            logger.info("📦 Using existing model from today")
        
        # Clean up old models
        beacon.cleanup_old_models(days_to_keep=7)
        logger.info("🧹 Cleaned up old models")
        
        logger.info("🎉 Daily training job completed successfully")
        
    except Exception as e:
        logger.error(f"❌ Daily training job failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
'''
    
    script_path = Path("daily_training_job.py")
    
    with open(script_path, 'w') as f:
        f.write(script_content)
    
    # Make script executable
    os.chmod(script_path, 0o755)
    
    print(f"✅ Created training script: {script_path.absolute()}")
    print("⚠️  Please update the paths in the script before running!")
    
    return script_path

def create_crontab_entry(script_path, hour=2, minute=0):
    """Create a crontab entry for daily training"""
    
    # Get absolute path
    abs_script_path = Path(script_path).absolute()
    
    # Create crontab entry
    cron_entry = f"{minute} {hour} * * * /usr/bin/python3 {abs_script_path} >> /var/log/beacon_training.log 2>&1"
    
    print(f"\n📅 Crontab entry for daily training at {hour:02d}:{minute:02d}:")
    print("-" * 60)
    print(cron_entry)
    print("-" * 60)
    
    print("\n🔧 To install this cron job:")
    print("1. Run: crontab -e")
    print("2. Add the above line to your crontab")
    print("3. Save and exit")
    print("\n💡 Alternative: Run the install command below:")
    print(f"echo '{cron_entry}' | crontab -")
    
    return cron_entry

def setup_log_directory():
    """Set up logging directory"""
    log_dirs = [
        "/var/log",  # System log directory (needs sudo)
        "/tmp/beacon_logs",  # Temporary directory
        "./logs"  # Local logs directory
    ]
    
    for log_dir in log_dirs:
        log_path = Path(log_dir)
        try:
            log_path.mkdir(parents=True, exist_ok=True)
            print(f"✅ Log directory ready: {log_path.absolute()}")
            return log_path
        except PermissionError:
            print(f"❌ Permission denied for: {log_path}")
            continue
    
    print("⚠️  Could not create log directory. Please create it manually.")
    return None

def create_systemd_service(script_path):
    """Create a systemd service file for the training job"""
    
    service_content = f'''[Unit]
Description=BeaconAI Daily Training Job
After=network.target

[Service]
Type=oneshot
User=your_username
Group=your_group
WorkingDirectory=/path/to/your/project
Environment=PATH=/usr/bin:/bin:/usr/local/bin
ExecStart=/usr/bin/python3 {Path(script_path).absolute()}
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
'''

    service_path = Path("beacon-training.service")
    
    with open(service_path, 'w') as f:
        f.write(service_content)
    
    print(f"\n🔧 Created systemd service file: {service_path.absolute()}")
    print("\n📋 To install the systemd service:")
    print("1. Update the service file with correct paths and user")
    print("2. sudo cp beacon-training.service /etc/systemd/system/")
    print("3. sudo systemctl daemon-reload")
    print("4. sudo systemctl enable beacon-training.service")
    print("\n⏰ To create a daily timer:")
    print("Create beacon-training.timer in /etc/systemd/system/ with:")
    print("""
[Unit]
Description=Run BeaconAI training daily
Requires=beacon-training.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
""")
    
    return service_path

def check_dependencies():
    """Check if required dependencies are installed"""
    required_packages = ['torch', 'numpy', 'scipy']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package} is installed")
        except ImportError:
            print(f"❌ {package} is missing")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n📦 Install missing packages:")
        print(f"pip install {' '.join(missing_packages)}")
        return False
    
    return True

def main():
    """Main setup function"""
    print("🚀 BeaconAI Daily Training Setup")
    print("=" * 50)
    
    # Check dependencies
    print("\n1️⃣ Checking dependencies...")
    if not check_dependencies():
        print("⚠️  Please install missing dependencies first")
        return
    
    # Setup log directory
    print("\n2️⃣ Setting up log directory...")
    log_dir = setup_log_directory()
    
    # Create training script
    print("\n3️⃣ Creating training script...")
    script_path = create_training_script()
    
    # Setup automation
    print("\n4️⃣ Setting up automation...")
    print("Choose automation method:")
    print("1. Cron job (recommended for simple setups)")
    print("2. Systemd service (recommended for production)")
    print("3. Manual execution only")
    
    choice = input("\nEnter choice (1-3): ").strip()
    
    if choice == "1":
        hour = int(input("Enter hour for daily training (0-23, default 2): ") or "2")
        minute = int(input("Enter minute (0-59, default 0): ") or "0")
        create_crontab_entry(script_path, hour, minute)
    elif choice == "2":
        create_systemd_service(script_path)
    else:
        print("📝 You can run the training script manually:")
        print(f"python3 {script_path.absolute()}")
    
    print("\n✅ Setup complete!")
    print("\n📋 Next steps:")
    print("1. Update paths in daily_training_job.py")
    print("2. Implement your data loading function")
    print("3. Test the script manually first")
    print("4. Set up the chosen automation method")
    print("5. Monitor the logs for successful execution")
    
    print(f"\n🔍 Test the script:")
    print(f"python3 {script_path.absolute()}")

if __name__ == "__main__":
    main() 