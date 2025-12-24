#include <stdio.h>
#include <stdlib.h>
#include <immintrin.h>

#define N 256

void matrix_multiply(double *A, double *B, double *C) {
    // Initialize C to zero
    for (int i = 0; i < N * N; i++) {
        C[i] = 0.0;
    }

    // Optimized multiplication using SIMD and loop reordering
    // We reorder loops to i -> k -> j to improve cache locality for B and C
    // B is accessed sequentially in inner loop (B[k*N + j])
    // C is accumulated in registers (C[i*N + j])
    // A is accessed once per k iteration (A[i*N + k])
    
    for (int i = 0; i < N; i++) {
        for (int k = 0; k < N; k++) {
            double a_val = A[i * N + k];
            double *b_ptr = &B[k * N];
            double *c_ptr = &C[i * N];
            
            // Process 4 elements at a time using AVX
            int j;
            for (j = 0; j <= N - 4; j += 4) {
                __m256d c_vec = _mm256_loadu_pd(&c_ptr[j]);
                __m256d b_vec = _mm256_loadu_pd(&b_ptr[j]);
                __m256d a_vec = _mm256_set1_pd(a_val);
                __m256d prod = _mm256_mul_pd(a_vec, b_vec);
                c_vec = _mm256_add_pd(c_vec, prod);
                _mm256_storeu_pd(&c_ptr[j], c_vec);
            }
            
            // Handle remaining elements
            for (; j < N; j++) {
                c_ptr[j] += a_val * b_ptr[j];
            }
        }
    }
}

int main() {
    // Aligned allocation for better SIMD performance
    double *A = aligned_alloc(32, N * N * sizeof(double));
    double *B = aligned_alloc(32, N * N * sizeof(double));
    double *C = aligned_alloc(32, N * N * sizeof(double));
    
    if (!A || !B || !C) {
        return 1;
    }
    
    // Vectorized initialization
    for (int i = 0; i < N * N; i++) {
        A[i] = (double)(i % 100) / 100.0;
        B[i] = (double)((i * 7) % 100) / 100.0;
    }
    
    matrix_multiply(A, B, C);
    
    double checksum = 0.0;
    // Vectorized reduction
    int i;
    __m256d sum_vec = _mm256_setzero_pd();
    for (i = 0; i <= N * N - 4; i += 4) {
        sum_vec = _mm256_add_pd(sum_vec, _mm256_loadu_pd(&C[i]));
    }
    
    // Horizontal sum
    double temp[4];
    _mm256_storeu_pd(temp, sum_vec);
    checksum = temp[0] + temp[1] + temp[2] + temp[3];
    
    // Remaining elements
    for (; i < N * N; i++) {
        checksum += C[i];
    }
    
    printf("%.6f\n", checksum);
    
    free(A); free(B); free(C);
    return 0;
}