#include <stdio.h>
#include <stdlib.h>

#define N 256

void matrix_multiply(double *A, double *B, double *C) {
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            double sum = 0.0;
            for (int k = 0; k < N; k++) {
                sum += A[i * N + k] * B[k * N + j];
            }
            C[i * N + j] = sum;
        }
    }
}

int main() {
    double *A = malloc(N * N * sizeof(double));
    double *B = malloc(N * N * sizeof(double));
    double *C = malloc(N * N * sizeof(double));
    
    for (int i = 0; i < N * N; i++) {
        A[i] = (double)(i % 100) / 100.0;
        B[i] = (double)((i * 7) % 100) / 100.0;
    }
    
    matrix_multiply(A, B, C);
    
    double checksum = 0.0;
    for (int i = 0; i < N * N; i++) {
        checksum += C[i];
    }
    
    printf("%.6f\n", checksum);
    
    free(A); free(B); free(C);
    return 0;
}