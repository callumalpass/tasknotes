import { execFileSync } from 'node:child_process';

export function pointer(...actions: Array<[string, number, number?]>) {
  execFileSync('python3', ['-c', `
import ctypes, json, os, time
xlib = ctypes.CDLL('libX11.so.6'); xtest = ctypes.CDLL('libXtst.so.6')
xlib.XOpenDisplay.restype = ctypes.c_void_p
display = xlib.XOpenDisplay(os.environ['DISPLAY'].encode())
assert display, 'XTest requires the isolated display'
xlib.XFlush.argtypes = [ctypes.c_void_p]
xlib.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
xtest.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
xtest.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
xtest.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
for action in json.loads(${JSON.stringify(JSON.stringify(actions))}):
 if action[0] == 'move': xtest.XTestFakeMotionEvent(display, -1, int(action[1]), int(action[2]), 0)
 elif action[0] == 'button': xtest.XTestFakeButtonEvent(display, 1, int(action[1]), 0)
 elif action[0] == 'escape':
  key = xlib.XKeysymToKeycode(display, 0xff1b)
  xtest.XTestFakeKeyEvent(display, key, 1, 0); xtest.XTestFakeKeyEvent(display, key, 0, 0)
 elif action[0] == 'question':
  shift = xlib.XKeysymToKeycode(display, 0xffe1); slash = xlib.XKeysymToKeycode(display, 0x2f)
  xtest.XTestFakeKeyEvent(display, shift, 1, 0); xtest.XTestFakeKeyEvent(display, slash, 1, 0)
  xtest.XTestFakeKeyEvent(display, slash, 0, 0); xtest.XTestFakeKeyEvent(display, shift, 0, 0)
 xlib.XFlush(display); time.sleep(0.08)
`]);
}
