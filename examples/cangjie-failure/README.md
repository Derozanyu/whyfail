# Cangjie failure example

`main.cj` intentionally references `userNmae` instead of `userName` on line 8.

From the WhyFail project root, preview the automatically selected command:

```powershell
node src\cli.js auto --cwd examples\cangjie-failure --plan
```

Run the check and open its local report:

```powershell
node src\cli.js auto --cwd examples\cangjie-failure
```

WhyFail should classify the result as a Cangjie compilation error and show `main.cj`, source line 8, in the report.
