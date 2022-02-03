set tabstop=4
set softtabstop=4
set shiftwidth=4
set expandtab

let g:telescope_ignore_patterns = ['dist/', '.git', 'node_modules/']

lua <<EOF
vim.fn['program_filetypes'] = function()
    require('program').setup({
        filetypes = {
            typescript = {
                interpreter = {
                    exe = "npm",
                    args = {
                        "run",
                        "dev"
                    }
                }
            }
        }
    })
end
vim.fn['formatter'] = function()
    require('formatter').setup({
        filetype = {
            typescript = {
              function()
                return {
                  exe = "prettier",
                  args = {
                      "--stdin-filepath",
                    vim.fn.fnameescape(vim.api.nvim_buf_get_name(0)),
                    },
                  stdin = true
                }
              end
            },
            json = {
              function()
                return {
                  exe = "prettier",
                  args = {
                      "--stdin-filepath",
                    vim.fn.fnameescape(vim.api.nvim_buf_get_name(0)),
                    },
                  stdin = true
                }
              end
            }
        }
    })
end
EOF

