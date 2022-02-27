# archbroski

__archbroski__ is a 3rd party tool for Path of Exile which suggests archnemesis modifiers to use according to your given preferences.

## 1. Installation

Install the program using the [installer](https://www.google.com).

## 2. Configuration

After running the program, right click on the system tray icon and click `Settings`. Here you can set your
activation hotkey and your combos.

## 3. Usage

First, make sure you are running Path of Exile in __windowed or borderless mode__ and that you ran __archbroski__ on the same monitor as Path of Exile.

Then, ingame, whenever you approach an archnemesis statue, click its icon and press your activation hotkey.

> __Important__: your stash, queue, and their immediate surroundings (~ 50 pixels around) should be __fully visible and unobstructed__ by anything (including your cursor!).

Once activated, the image recognition algorithm will parse your stash and queue. This may take a few seconds, but every time-consuming action is cached, so subsequent activations should be reasonably fast (< 100ms on my system).
 
If all goes well, you'll see a single modifier highlighted and a green checkmark at the bottom of your screen. A red exclamation point indicates that the image recognition failed, and a red question mark indicates that for some reason, the logical component couldn't select a modifier to use.
 
Whatever the result was, you can hide the overlay with any key or mouse button press.

> __Important:__ if, for any reason, your UI differs in size, or you use anything akin to Reshade, SweetFX, NVIDIA Freestyle, etc.,
the image recognition is __very likely to fail__ (fail to recognize the layout or misidentify the modifiers).

## 4. Having issues?

Don't be shy, just open a bug report [here](https://github.com/moxaj/archbroski/issues). Also, if you are a seasoned rust or react dev, feel free to provide any feedback regarding the implementation.