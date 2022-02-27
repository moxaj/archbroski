# archbroski

__archbroski__ is a 3rd party tool for Path of Exile which suggests archnemesis modifiers to use according to your given preferences.

## 1. Installation

Install the program using the [installer](https://www.google.com).

## 2. Configuration

After running the program, right click on the system tray icon and click `Settings`.

Here you can find:
 - your combos
 - the activation hotkey
 - the calculation mode
 - the relative reward type weights, if using `Smart` mode

## 3. Usage

First, make sure you are running Path of Exile in windowed or borderless mode and that you ran __archbroski__ on the same monitor as Path of Exile.

Then, ingame, whenever you approach an archnemesis statue, click its icon and press your activation hotkey. When you do this, make sure that:

 - your stash and its left side are fully visible
 - the queue and its top side are fully visible

 I suggest you move your mouse to the bottom of your screen so that it doesn't interfere with the image recognition.

 Once activated, the image recognition algorithm will parse your stash and queue. This may take a few seconds, but every time-consuming action is cached, so subsequent activations should be reasonably fast (< 100ms on my system).
 
 If all goes well, you'll see a single modifier highlighted and a green checkmark at the bottom of your screen. A red exclamation point indicates that the image recognition failed, and a red question mark indicates that for some reason, the logical component couldn't select a modifier to use.
 
 Whatever the result was, you can hide the overlay with any key or mouse button press.

 ## 4. Having issues?

 Don't be shy, just open a bug report [here](https://github.com/moxaj/archbroski/issues). Also, if you are a seasoned rust or react dev, feel free to provide any feedback regarding the implementation.