lua << EOF
require("telescope").setup({
	pickers = {
		find_files = {
			theme = "ivy",
			hidden = 1,
			file_ignore_patterns = {"__pycache__/", ".git/"}
			}
		}
})
EOF
