@echo off
rem Copy this file to the HOST repository root (next to the ebex/ folder).
rem It only delegates to ebex/start.bat so the launcher logic stays in one place.
rem Keep this file ASCII-only: cmd.exe reads .bat in the console codepage.
call "%~dp0ebex\start.bat" %*
