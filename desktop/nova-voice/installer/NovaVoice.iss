; Nova Voice — Inno Setup 6 script (Windows x64)
; Builds: NovaVoice-Setup-v0.16.0.dev1.exe from: ..\dist\NovaVoice\ (produced by Build-Windows.bat)
; Per-user install (no admin/UAC). User data (%LOCALAPPDATA%\NovaVoice: voices, settings,
; library) is deliberately NEVER touched or removed by install/uninstall.
; Inno Setup is a build tool only; it is not redistributed inside the installer.

#define AppName "Nova Voice"
#define AppVersion "0.16.0.dev1"
#define AppPublisher "Nova Voice Project"
#define AppURL "https://github.com/a3laaw/Nova2026-ERP"
#define AppExeName "NovaVoice.exe"
#define SourceDir "..\dist\NovaVoice"

[Setup]
AppId={{7E5D3B10-3F52-4B4F-9F73-0F3F0B8F3A01}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
AppCopyright=GPL-3.0-or-later
DefaultDirName={userpf}\Nova Voice
DefaultGroupName={#AppName}
DisableProgramGroupPage=no
LicenseFile=..\LICENSE
OutputDir=..\dist
OutputBaseFilename=NovaVoice-Setup-v{#AppVersion}
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName} {#AppVersion}
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
MinVersion=10.0
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ChangesAssociations=no
VersionInfoVersion=0.16.0.1
VersionInfoCompany={#AppPublisher}
VersionInfoDescription=Nova Voice installer

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{group}\دليل التشغيل (ابدأ هنا)"; Filename: "{app}\RUN-FIRST-AR.html"
Name: "{group}\مكتبة المنهج — الدليل"; Filename: "{app}\LESSON-LIBRARY-AR.md"
Name: "{group}\كل الإمكانات — استدلال"; Filename: "{app}\INFERENCE-GUIDE-AR.html"
Name: "{group}\إلغاء تثبيت {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch Nova Voice"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Nothing outside {app} is owned by the installer; user data is kept by design.
Type: dirifempty; Name: "{app}"
