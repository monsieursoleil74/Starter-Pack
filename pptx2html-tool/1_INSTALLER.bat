@echo off
chcp 65001 >nul
echo ============================================
echo  Installation PPTX2HTML - une seule fois
echo ============================================
echo.
where python >nul 2>nul
if errorlevel 1 (
    echo [!] Python n'est pas installe ou pas dans le PATH.
    echo     Telecharge-le sur python.org et coche
    echo     "Add Python to PATH" pendant l'installation.
    pause
    exit /b 1
)
echo Python : OK
echo Installation de python-pptx, tkinterdnd2 et pymupdf...
python -m pip install --quiet python-pptx tkinterdnd2 pymupdf
if errorlevel 1 (
    echo [!] Echec de l'installation des dependances Python.
    pause
    exit /b 1
)
echo python-pptx + tkinterdnd2 + pymupdf : OK
echo.
if exist "C:\Program Files\LibreOffice\program\soffice.exe" (
    echo LibreOffice : OK
) else (
    echo [!] LibreOffice non trouve - installe-le depuis libreoffice.org
)
python -c "import pymupdf" >nul 2>nul
if errorlevel 1 (
    python -c "import fitz" >nul 2>nul
    if errorlevel 1 (
        echo [!] PyMuPDF indisponible - en secours, dezippe Poppler dans C:\poppler
        echo     https://github.com/oschwartz10612/poppler-windows/releases
    ) else (
        echo Rendu d'images ^(PyMuPDF^) : OK
    )
) else (
    echo Rendu d'images ^(PyMuPDF^) : OK
)
echo.
echo Installation terminee. Lance "2_LANCER_TOOL.bat".
pause
