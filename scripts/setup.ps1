Write-Host "Installing JavaScript workspace dependencies..."
npm install

Write-Host "Creating Python virtual environment..."
python -m venv .venv

Write-Host "To activate the environment run:"
Write-Host ".venv\\Scripts\\activate"

Write-Host "Then install Python data dependencies with:"
Write-Host "python -m pip install -r data/requirements.txt"
