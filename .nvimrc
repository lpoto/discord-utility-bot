let g:telescope_ignore_patterns = ['__pycache__/', '.git/']
let g:telescope_previewer = 1

lua << EOF
vim.fn['program_defaults'] = function()
	require('program').setup({
		errorlist = {
			size = 100,
			type = 0,
			save = true,
		},
	})
end
vim.fn['program_filetypes'] = function()
    require('program').setup({
        filetypes = {
            python = {
                interpreter = {
                    exe = 'python3',
                    args = {
                        require('root')().."/main.py",
                    },
                    end_args = {
                        '--dev'
                    },
                },
            }
        }
    })
end

vim.fn['formatter'] = function()
    require('formatter').setup({
        filetype = {
            python = {
              function()
                return {
                  exe = "python3 -m autopep8",
                  args = {
                    "--in-place --aggressive --aggressive --aggressive",
                    vim.fn.fnameescape(vim.api.nvim_buf_get_name(0))
                  },
                  stdin = false
                }
              end
            }
        }
    })
end
EOF
