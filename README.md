# archbroski

__archbroski__ is a 3rd party tool for Path of Exile which suggests archnemesis modifiers to use according to your preferences.

## 1. Installation

Install the program using the installer downloaded from [here](https://www.google.com).

## 2. Configuration

After running the program, right click on the system tray icon and click `Settings`. Set up your configuration hotkey and combos. You may change these any time, and any changes made are immediately in effect and synced to your local filesystem.

## 3. Usage

Approach an archnemesis status and click its icon. Once the UI is visible, press your activation hotkey, and, if everything goes well,
a single modifier should be highlighted. Press any key to hide the overlay and use that modifier!

> __IMPORTANT__
> 
> 1. make sure you are running Path of Exile in __windowed or borderless mode__ and that you ran __archbroski__ on the same monitor as Path of Exile
> 2. when you press your activation key:
>    - your stash, queue, and their immediate surroundings (~ 50 pixels around) > should be __fully visible and unobstructed__
>     by anything (including your cursor!)
>    - do __NOT__ move your cursor around too much - for some obscure reason, the app won't be able to take a screenshot
> 3. if, for any reason, your UI differs in size, or you use anything akin to Reshade, SweetFX, NVIDIA Freestyle, etc.,
the image recognition is __very likely to fail__ (fail to recognize the layout or misidentify the modifiers)
> 4. the initial activation may take a few seconds, but subsequent activations should be reasonably fast (< 100ms)
> 5. would the activation fail, a red exclamation point indicates that the image recognition failed, while a red question mark indicates that the system could not select
a modifier to use (for whatever reason)

## 4. Having issues?

Don't be shy, just file an issue [here](https://github.com/moxaj/archbroski/issues). Also, if you are a seasoned rust or react dev, feel free to provide any feedback regarding the implementation.