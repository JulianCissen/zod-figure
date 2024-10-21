# Change Log
## 1.3.2 (2024-10-21)
### Bug Fixes
- Fixed an issue where public methods relying on `typeof this.currentConfigValue` were typed as any since `this.currentConfigValue` is a private member which loses typing on compilation.
## 1.3.1 (2024-10-21)
### Bug Fixes
- Removed the types specifier in `package.json` since types aren't bundled.
## 1.3.0 (2024-10-21)
### Features
- Changed the package build process from a bundler to native `tsc`.