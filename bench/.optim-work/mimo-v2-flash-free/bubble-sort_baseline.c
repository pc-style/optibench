#include <stdio.h>
#include <stdlib.h>

#define N 10000

void bubble_sort(int *arr, int n) {
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}

int main() {
    int *arr = malloc(N * sizeof(int));
    
    unsigned int seed = 12345;
    for (int i = 0; i < N; i++) {
        seed = seed * 1103515245 + 12345;
        arr[i] = (seed >> 16) & 0x7fff;
    }
    
    bubble_sort(arr, N);
    
    long long checksum = 0;
    for (int i = 0; i < N; i++) {
        checksum += arr[i] * (long long)(i + 1);
    }
    
    printf("%lld\n", checksum);
    
    free(arr);
    return 0;
}