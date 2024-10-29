# Change Log
## 1.5.0 (2024-10-29)
### Features
- Added a way to shortcut schema definitions if no env variables are used. [#1](https://github.com/JulianCissen/zod-figure/issues/1)
- Exposed environment variables to the load function. This allows users to use environment variables to select the right source to load. [#2](https://github.com/JulianCissen/zod-figure/issues/2)
- Created a type that allows inferring the config value type from the ZodConfig instance. [#3](https://github.com/JulianCissen/zod-figure/issues/3)
- Added a manual reload method. [#4](https://github.com/JulianCissen/zod-figure/issues/4)
### Bug Fixes
- Removed an old dependency leftover from boilerplate code.
- Fixed an issue in one of the tests where environment variables would not be unassigned after loading dotenv variables.
## 1.4.0 (2024-10-21)
### Features
- Considerably expanded README with full API reference.
- Added support for automatically setting adapter to `YamlAdapter` when loaded file extension is `.yml`.
## 1.3.2 (2024-10-21)
### Bug Fixes
- Fixed an issue where public methods relying on `typeof this.currentConfigValue` were typed as any since `this.currentConfigValue` is a private member which loses typing on compilation.
## 1.3.1 (2024-10-21)
### Bug Fixes
- Removed the types specifier in `package.json` since types aren't bundled.
## 1.3.0 (2024-10-21)
### Features
- Changed the package build process from a bundler to native `tsc`.