#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define N 10000

// Optimized sorting using Counting Sort
// Time Complexity: O(N + Range) -> O(N) for this specific input range
// Space Complexity: O(Range)
void optimized_sort(int *arr, int n) {
    // Input range is [0, 32767] based on (seed >> 16) & 0x7fff
    const int MAX_VAL = 32768;
    int *count = (int*)calloc(MAX_VAL, sizeof(int));
    
    // Count frequencies
    for (int i = 0; i < n; i++) {
        count[arr[i]]++;
    }
    
    // Reconstruct sorted array
    int idx = 0;
    for (int val = 0; val < MAX_VAL; val++) {
        int c = count[val];
        if (c > 0) {
            // Unroll loop for small counts to help compiler vectorize
            // Most values will have small counts
            while (c >= 8) {
                arr[idx] = val; arr[idx+1] = val; arr[idx+2] = val; arr[idx+3] = val;
                arr[idx+4] = val; arr[idx+5] = val; arr[idx+6] = val; arr[idx+7] = val;
                idx += 8;
                c -= 8;
            }
            while (c > 0) {
                arr[idx++] = val;
                c--;
            }
        }
    }
    
    free(count);
}

int main() {
    int *arr = (int*)malloc(N * sizeof(int));
    
    // Optimized RNG generation with loop unrolling
    unsigned int seed = 12345;
    const unsigned int mult = 1103515245;
    const unsigned int add = 12345;
    
    // Process in blocks for better instruction-level parallelism
    for (int i = 0; i < N; i += 4) {
        seed = seed * mult + add;
        arr[i] = (seed >> 16) & 0x7fff;
        
        if (i + 1 < N) {
            seed = seed * mult + add;
            arr[i+1] = (seed >> 16) & 0x7fff;
        }
        if (i + 2 < N) {
            seed = seed * mult + add;
            arr[i+2] = (seed >> 16) & 0x7fff;
        }
        if (i + 3 < N) {
            seed = seed * mult + add;
            arr[i+3] = (seed >> 16) & 0x7fff;
        }
    }
    
    // Use counting sort instead of bubble sort
    optimized_sort(arr, N);
    
    // Optimized checksum calculation with loop unrolling
    long long checksum = 0;
    long long sum1 = 0, sum2 = 0, sum3 = 0, sum4 = 0;
    
    for (int i = 0; i < N; i += 4) {
        long long base = i + 1;
        if (i + 3 < N) {
            sum1 += (long long)arr[i] * base;
            sum2 += (long long)arr[i+1] * (base + 1);
            sum3 += (long long)arr[i+2] * (base + 2);
            sum4 += (long long)arr[i+3] * (base + 3);
        } else {
            // Handle remainder
            for (int j = i; j < N && j < i + 4; j++) {
                checksum += (long long)arr[j] * (j + 1);
            }
        }
    }
    checksum = sum1 + sum2 + sum3 + sum4;
    
    printf("%lld\n", checksum);
    
    free(arr);
    return 0;
}