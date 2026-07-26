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
echo Installation de python-pptx et tkinterdnd2...
python -m pip install --quiet python-pptx tkinterdnd2
if errorlevel 1 (
    echo [!] Echec de l'installation des dependances Python.
    pause
    exit /b 1
)
echo python-pptx + tkinterdnd2 : OK
echo.
if exist "C:\Program Files\LibreOffice\program\soffice.exe" (
    echo LibreOffice : OK
) else (
    echo [!] LibreOffice non trouve - installe-le depuis libreoffice.org
)
if exist "C:\poppler\Library\bin\pdftoppm.exe" (
    echo Poppler : OK
) else (
    where pdftoppm >nul 2>nul
    if errorlevel 1 (
        echo [!] Poppler non trouve - dezippe-le dans C:\poppler
        echo     https://github.com/oschwartz10612/poppler-windows/releases
    ) else (
        echo Poppler : OK
    )
)
echo.
echo Installation terminee. Lance "2_LANCER_TOOL.bat".
pause
