#include <stdio.h>
#include <stdlib.h>

#define N 100000000

double array_sum(double *arr, int n) {
    double sum = 0.0;
    for (int i = 0; i < n; i++) {
        sum += arr[i];
    }
    return sum;
}

int main() {
    double *arr = malloc(N * sizeof(double));
    
    for (int i = 0; i < N; i++) {
        arr[i] = 1.0 / (i + 1);
    }
    
    double result = array_sum(arr, N);
    printf("%.10f\n", result);
    
    free(arr);
    return 0;
}