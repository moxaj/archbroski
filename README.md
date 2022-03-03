# archbroski

__archbroski__ is a 3rd party tool for Path of Exile which suggests archnemesis modifiers to use according to your preferences.

## Installation

Install the program using the installer downloaded from [here](https://github.com/moxaj/archbroski/releases).

## Configuration

After running the program, right click on the system tray icon and click `Settings`. Set up your configuration hotkey and combos. You may change these any time, and any changes made are immediately in effect and synced to your local filesystem.

Hotkey support is rather limited, `ctrl` / `alt` / `shift` + `a-z`, `0-9`, `F1-12`.

## Usage

Approach an archnemesis status and click its icon. Once the UI is visible, press your activation hotkey. Then, one of 3 things could happen:
 - __a__, a single modifier is highlighted and a green checkmark pops up. Simply use that modifier.
 - __b__, the image recognition algorithm fails, indicated by a red explamation point. For why this might have happened, read through the `IMPORTANT` points below
 - __c__, the logic algorithm fails, indicated by a red question mark. This can only happen if you don't have enough different filler modifiers in your stash.

Whatever happens, you can close the overlay by pressing any key or mouse button. Also, the very first activation after installation could take a few seconds,
but subsequent activations should (eventually) be reasonably fast (< 100ms).

> __IMPORTANT__
> 
> 1. make sure you are running Path of Exile in __windowed or borderless mode__ and that you ran __archbroski__ on the same monitor as Path of Exile
> 2. when you press your activation key:
>    - your stash, queue, and their immediate surroundings (~ 50 pixels around) > should be __fully visible and unobstructed__
>     by anything (including your cursor!)
>    - do __NOT__ move your cursor around too much - for some obscure reason, the app won't be able to take a screenshot
> 3. if, for any reason, your UI differs in size, or you use anything akin to Reshade, SweetFX, NVIDIA Freestyle, etc.,
the image recognition is __very likely to fail__ (fail to recognize the layout or misidentify the modifiers)

## Having issues?

Report [here](https://github.com/moxaj/archbroski/issues).

## License

<sup>
Licensed under either of <a href="LICENSE-APACHE">Apache License, Version
2.0</a> or <a href="LICENSE-MIT">MIT license</a> at your option.
</sup>

<br>

<sub>
Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this crate by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
</sub>