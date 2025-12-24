#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define TEXT_LEN 1000000
#define PATTERN "ABCDABD"

int naive_search(const char *text, const char *pattern) {
    int n = strlen(text);
    int m = strlen(pattern);
    int count = 0;
    
    for (int i = 0; i <= n - m; i++) {
        int j;
        for (j = 0; j < m; j++) {
            if (text[i + j] != pattern[j])
                break;
        }
        if (j == m) count++;
    }
    return count;
}

int main() {
    char *text = malloc(TEXT_LEN + 1);
    
    unsigned int seed = 42;
    for (int i = 0; i < TEXT_LEN; i++) {
        seed = seed * 1103515245 + 12345;
        text[i] = 'A' + ((seed >> 16) % 8);
    }
    text[TEXT_LEN] = '\0';
    
    int count = naive_search(text, PATTERN);
    printf("%d\n", count);
    
    free(text);
    return 0;
}