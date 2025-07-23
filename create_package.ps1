# PowerShell script to create a distributable package for Ableton Metrolink

# Define the output zip file name
$zipFileName = "Ableton-Metrolink-Distributable.zip"

# Define files and directories to include
$filesToInclude = @(
    "index.html",
    "server.py",
    "server.js",
    "styles.css",
    "package.json",
    "start_metrolink.bat",
    "SETUP_INSTRUCTIONS.md",
    "service-worker.js",
    "audio-cache.js",
    "sounds"
)

# Define files and directories to exclude
$excludePatterns = @(
    "node_modules",
    ".git",
    ".idea",
    ".venv",
    "*.zip",
    "create_package.ps1"
)

Write-Host "Creating distributable package for Ableton Metrolink..."

# Create a temporary directory
$tempDir = ".\temp_package"
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}
New-Item -Path $tempDir -ItemType Directory | Out-Null

# Copy files to the temporary directory
foreach ($item in $filesToInclude) {
    if (Test-Path $item) {
        if ((Get-Item $item) -is [System.IO.DirectoryInfo]) {
            # It's a directory, copy it recursively
            Copy-Item -Path $item -Destination $tempDir -Recurse
        } else {
            # It's a file, copy it
            Copy-Item -Path $item -Destination $tempDir
        }
        Write-Host "Added: $item"
    } else {
        Write-Host "Warning: $item not found, skipping"
    }
}

# Create the zip file
if (Test-Path $zipFileName) {
    Remove-Item -Path $zipFileName -Force
}

Write-Host "Compressing files..."
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipFileName

# Clean up the temporary directory
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Package created successfully: $zipFileName"
Write-Host "The package contains all necessary files to run Ableton Metrolink on Windows 10/11."
Write-Host "Users should follow the instructions in SETUP_INSTRUCTIONS.md to set up and run the application."