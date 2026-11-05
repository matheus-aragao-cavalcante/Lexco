; Lexco — ajustes do instalador (incluído pelo electron-builder em nsis.include).
;
; Ao instalar por cima de uma versão anterior, o Windows costuma manter o ÍCONE
; ANTIGO dos atalhos em cache. Aqui forçamos a atualização desse cache.
; Os dados do usuário (%APPDATA%\<app>) não são tocados.

!macro customInstall
  nsExec::Exec '"$SYSDIR\ie4uinit.exe" -show'
  nsExec::Exec '"$SYSDIR\ie4uinit.exe" -ClearIconCache'
  ; SHCNE_ASSOCCHANGED: avisa o Explorer para redesenhar os ícones.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
