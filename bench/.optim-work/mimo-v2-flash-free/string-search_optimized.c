#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <immintrin.h>

#define TEXT_LEN 1000000
#define PATTERN "ABCDABD"

// Optimized search using Boyer-Moore-Horspool algorithm
int optimized_search(const char *text, const char *pattern) {
    int n = strlen(text);
    int m = strlen(pattern);
    
    if (m == 0 || n < m) return 0;
    
    // Preprocess bad character shift table
    int bad_char[256];
    for (int i = 0; i < 256; i++) {
        bad_char[i] = m;
    }
    for (int i = 0; i < m - 1; i++) {
        bad_char[(unsigned char)pattern[i]] = m - 1 - i;
    }
    
    int count = 0;
    int i = 0;
    
    // Main search loop with SIMD for pattern matching when m is small
    if (m <= 16) {
        // Use SIMD for faster comparison
        __m128i pattern_vec = _mm_loadu_si128((const __m128i*)pattern);
        __m128i mask = _mm_set1_epi8(0xFF);
        
        // Create mask for pattern length
        if (m < 16) {
            unsigned long long mask_val = (1ULL << m) - 1;
            mask = _mm_set_epi64x(0, mask_val);
        }
        
        while (i <= n - m) {
            // Load 16 bytes from text
            __m128i text_vec = _mm_loadu_si128((const __m128i*)(text + i));
            
            // Compare with pattern
            __m128i cmp = _mm_cmpeq_epi8(text_vec, pattern_vec);
            int mask_res = _mm_movemask_epi8(cmp);
            
            // Check if first m bytes match
            if ((mask_res & ((1 << m) - 1)) == ((1 << m) - 1)) {
                count++;
                i += 1; // Shift by 1 for overlapping matches
            } else {
                // Use bad character heuristic
                unsigned char last_char = (unsigned char)text[i + m - 1];
                i += bad_char[last_char];
            }
        }
    } else {
        // Standard Boyer-Moore-Horspool for larger patterns
        while (i <= n - m) {
            int j = m - 1;
            while (j >= 0 && pattern[j] == text[i + j]) {
                j--;
            }
            if (j < 0) {
                count++;
                i++; // Shift by 1 for overlapping matches
            } else {
                unsigned char last_char = (unsigned char)text[i + m - 1];
                i += bad_char[last_char];
            }
        }
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
    
    int count = optimized_search(text, PATTERN);
    printf("%d\n", count);
    
    free(text);
    return 0;
}