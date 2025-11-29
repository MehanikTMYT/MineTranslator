### JAR Translator

[Russian version](README-ru.md)

This client application allows you to process JAR files by translating the content from one language to another using various translators via the jsontt module [Thanks to](https://github.com/mololab/json-translator)

## 🚀 Installation and Setup

### Requirements
- Python 3.7+
- pip (Python package manager)

### Installing Dependencies
```bash
# Install main dependencies
pip install -r requirements.txt

# OR install separately
pip install requests tqdm
```

**Explanation about tqdm:**
`tqdm` is a library for displaying progress bars in the console. It's not mandatory, but significantly improves user experience when processing a large number of files by showing real-time progress. If you don't install `tqdm`, the application will work in normal mode without a progress bar, but with all other features intact.

## 🎛️ Usage

### Starting the Application
Navigate to the directory with JAR files and run the command:

```bash
python translator.py [options]
```

### 🔧 Main Command Line Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--fb` | `yes` | Use fallback translator on errors (`yes`/`no`) |
| `--cl` | `3` | Maximum number of translation attempts per key |
| `--m` | `bing` | Main translation method (`google`, `google2`, `bing`) |
| `--f` | `en` | Source language (language code) |
| `--t` | `ru` | Target language (language code) |
| `--input_dir` | `.` | Directory to search for JAR files |
| `--output_dir` | `1` | Directory for translated files |
| `--output_invalid` | `2` | Directory for invalid files |
| `--output_corrupted` | `3` | Directory for corrupted files |
| `--threads` | `3` | Number of threads for processing |
| `--recursive` | - | Recursive search for JAR files |
| `--skip_existing` | - | Skip files that already exist in output_dir |
| `--dry_run` | - | Test mode without actual processing |
| `--log_file` | `translator.log` | File for logging |
| `--verbose` | - | Detailed logging (DEBUG level) |
| `--server_url` | `http://mehhost.ru:8150/process` | API server URL |

### 🌐 Supported Languages

The following language codes are supported in the application:

```
af, sq, am, ar, hy, az, eu, be, bn, bs, bg, ca, ceb, ny,
zh-CN, zh-TW, co, hr, cs, da, nl, en, eo, et, tl, fi, fr,
fy, gl, ka, de, el, gu, ht, ha, haw, iw, hi, hmn, hu,
is, ig, id, ga, it, ja, jw, kn, kk, km, ko, ku, ky, lo,
la, lv, lt, lb, mk, mg, ms, ml, mt, mi, mr, mn, my, ne,
no, ps, fa, pl, pt, pa, ro, ru, sm, gd, sr, st, sn, sd,
si, sk, sl, so, es, su, sw, sv, tg, ta, te, th, tr, uk,
ur, uz, vi, cy, xh, yi, yo, zu
```

[Original list](https://github.com/mololab/json-translator/blob/master/docs/LANGUAGES.md)

### 🎯 Usage Examples

**Basic usage:**
```bash
python translator.py
```

**Advanced usage with settings:**
```bash
python translator.py \
  --input_dir ./mods \
  --output_dir ./translated \
  --output_invalid ./invalid \
  --output_corrupted ./corrupted \
  --threads 5 \
  --recursive \
  --skip_existing \
  --m google2 \
  --f en \
  --t zh-CN
```

**Test mode (no actual processing):**
```bash
python translator.py --dry_run --verbose
```

## ⚙️ Features and Advantages

### 🔄 Multi-threaded Processing
The application supports parallel file processing with configurable number of threads (`--threads`). This significantly speeds up processing when handling a large number of JAR files.

### 📊 Progress Bar
When `tqdm` is installed, an interactive progress bar is displayed showing:
- Current number of processed files
- Remaining time
- Processing speed

### 📈 Detailed Statistics
After processing completion, detailed statistics are displayed:
```
==================================================
📊 PROCESSING STATISTICS
==================================================
✅ Successful:       42
❌ Errors:           3
🧩 Invalid:          5
🔧 Corrupted:        2
⏭️ Skipped:          1
📈 Total:            53
🎯 Success rate:     79.2%
==================================================
```

### 🔍 Smart File Validation
Before sending to the server, files are checked for:
- File existence
- Zero size (empty files)
- Exceeding maximum size (100MB)
- Correct extension (.jar)

### 🔄 Automatic Retry Mechanism
On temporary network or server errors:
- Automatic retry attempts (up to 3 times)
- Exponential backoff between attempts
- Different strategies for different error types

### 🚨 Smart Error Handling
The system automatically classifies errors and moves files to appropriate directories:
- **Corrupted files**: files with invalid ZIP/JAR structure
- **Invalid files**: files without required assets/lang folders
- **API errors**: server-side problems

### 📁 Flexible File System
- Automatic directory creation when needed
- Safe file moving with conflict checking
- Backup of original files when deletion fails

### 📝 Advanced Logging
- Log writing to file (`translator.log` by default)
- Detailed logging level (`--verbose` for DEBUG)
- Colorful emojis for better readability
- Logging of all critical events and errors

## 🛠️ Error Handling

When processing JAR files, the following scenarios are possible:

✅ **Successful processing**: The file will be saved in the directory specified with the `--output_dir` argument.

🧩 **Invalid files**: If the file does not contain the required folders (assets, lang), it will be moved to the `--output_invalid` directory.

🔧 **Corrupted files**: If the file is corrupted (invalid ZIP structure), it will be moved to the `--output_corrupted` directory.

⏭️ **Skipped files**: Files that fail validation (too large, empty, wrong extension) will be skipped and logged.

## 📊 Application Output Example

```
============================================================
🚀 STARTING MINECRAFT MOD TRANSLATOR CLIENT
============================================================
📁 Working directory: /home/user/mods
🔗 Server URL: http://mehhost.ru:8150/process
🔍 Found JAR files: 53
⏭️ Skipped files: 1
🎯 Starting processing of 52 files...
⚙️ Processing parameters: {'fb': 'yes', 'cl': 3, 'm': 'bing', 'f': 'en', 't': 'ru'}
✅ Successfully saved: mod1_translated.jar
🔧 File corrupted: old_mod.jar - invalid zip file
🧩 Invalid mod structure: texture_pack.jar - missing folder "assets"
✅ Successfully saved: mod2_translated.jar
...
✅ PROCESSING COMPLETED
============================================================
```

## 🚨 Possible Problems and Solutions

### ❌ Problem: "ModuleNotFoundError: No module named 'tqdm'"
**Solution:** Install the tqdm library:
```bash
pip install tqdm
```
*The application will work without tqdm, but without a progress bar.*

### ❌ Problem: "ConnectionError" or network issues
**Solution:**
- Check server availability
- Increase request timeouts (in code)
- Use `--dry_run` flag for testing

### ❌ Problem: Insufficient file writing permissions
**Solution:**
- Run the application with administrator privileges
- Specify directories with write permissions via arguments

### ❌ Problem: Files not moving/deleting
**Solution:**
- Check directory access permissions
- Ensure files are not being used by other processes
- Use `--skip_existing` flag to avoid conflicts

## 💡 Conclusion

This application provides a powerful and flexible tool for bulk translation of Minecraft mods. Thanks to multi-threaded processing, automatic error handling, and detailed statistics, it greatly simplifies working with a large number of JAR files.

**Tips for efficient usage:**
- Use `--dry_run` to test parameters before actual processing
- Start with a small number of threads (`--threads 2-3`) for stable operation
- Always make backup copies of original files before bulk processing
- Use `--verbose` for detailed debug logging when troubleshooting

If you encounter any problems, please check the correctness of command line arguments and ensure all dependencies are properly installed.